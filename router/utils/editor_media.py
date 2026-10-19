"""Image storage and lossless compression used by the local editor."""

import hashlib
import io
import re
from functools import lru_cache
from pathlib import Path

from PIL import Image, UnidentifiedImageError

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def smaller_webp(data: bytes) -> tuple[bytes, str]:
    """Convert only when smaller and pixel-identical; preserve ICC and EXIF.

    Animated images stay in their original format. Stored images are not resized.
    """
    with Image.open(io.BytesIO(data)) as image:
        suffix = {"JPEG": ".jpg", "PNG": ".png", "GIF": ".gif", "WEBP": ".webp"}.get(
            image.format or ""
        )
        if suffix is None:
            raise ValueError("Поддерживаются PNG, JPEG, GIF и WebP")
        if (
            getattr(image, "is_animated", False)
            or image.format == "WEBP"
            or image.mode not in {"1", "L", "LA", "P", "RGB", "RGBA"}
            or max(image.size) > 16383
        ):
            return data, suffix
        image.load()
        rgba = image.convert("RGBA")
        output = io.BytesIO()
        options = {"lossless": True, "exact": True, "quality": 75, "method": 4}
        if image.format == "JPEG":
            # In lossless mode quality controls effort, never pixel fidelity.
            # JPEG photos usually grow, so try the fast encoder first.
            options.update(quality=0, method=0)
        for key in ("icc_profile", "exif", "xmp"):
            if image.info.get(key):
                options[key] = image.info[key]
        rgba.save(output, "WEBP", **options)
        encoded = output.getvalue()
        if len(encoded) >= len(data):
            return data, suffix
        with Image.open(io.BytesIO(encoded)) as decoded:
            if decoded.convert("RGBA").tobytes() != rgba.tobytes():
                return data, suffix
        return encoded, ".webp"


def image_folder(static_dir: Path, folder: str) -> Path:
    relative = Path(folder)
    if (
        relative.is_absolute()
        or ".." in relative.parts
        or any(char in folder for char in "\\\x00")
    ):
        raise ValueError(
            "Укажи папку относительно images, например organisations/SierraBiotech"
        )
    target = (static_dir / "images" / relative).resolve()
    if not target.is_relative_to(
        (static_dir / "images").resolve()
    ) or not target.is_relative_to(static_dir.resolve()):
        raise ValueError("Папка должна находиться внутри static/images")
    return target


def list_media(static_dir: Path, folder: str) -> dict:
    directory = image_folder(static_dir, folder)
    if not directory.is_dir():
        raise ValueError("Папка изображений не найдена")
    folders, images = [], []
    for path in sorted(directory.iterdir()):
        if not path.resolve().is_relative_to(
            static_dir.resolve()
        ) or path.name.startswith("."):
            continue
        if path.is_dir():
            folders.append(
                {
                    "name": path.name,
                    "path": path.relative_to(static_dir / "images").as_posix(),
                }
            )
        elif path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
            stat = path.stat()
            images.append(
                {
                    "path": path.relative_to(static_dir).as_posix(),
                    "name": path.name,
                    "bytes": stat.st_size,
                    "version": str(stat.st_mtime_ns),
                }
            )
    return {"folder": folder, "folders": folders, "images": images}


def store_upload(
    static_dir: Path, filename: str, data: bytes, folder: str = "uploads"
) -> dict:
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("Размер изображения должен быть от 1 байта до 50 МБ")
    try:
        encoded, suffix = smaller_webp(data)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("Не удалось прочитать изображение") from error
    stem = (
        re.sub(r"[^\w-]+", "-", Path(filename).stem, flags=re.UNICODE).strip("-")[:60]
        or "image"
    )
    digest = hashlib.sha256(encoded).hexdigest()[:16]
    directory = image_folder(static_dir, folder)
    if not directory.resolve().is_relative_to(static_dir.resolve()):
        raise ValueError("Папка загрузки должна находиться внутри static")
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / (stem + "-" + digest + suffix)
    for existing in directory.glob("*-" + digest + suffix):
        if not existing.is_symlink() and existing.read_bytes() == encoded:
            target = existing
            break
    try:
        with target.open("xb") as stream:
            stream.write(encoded)
    except FileExistsError:
        if target.is_symlink() or target.read_bytes() != encoded:
            raise ValueError("Имя изображения уже занято") from None
    return {
        "path": target.relative_to(static_dir).as_posix(),
        "bytes": len(encoded),
        "original_bytes": len(data),
    }


def thumbnail(path: Path) -> bytes:
    with Image.open(path) as image:
        if image.format == "JPEG":
            image.draft("RGB", (240, 160))
        # The gallery thumbnail is separate from the untouched full-size asset.
        from PIL import ImageOps

        image = ImageOps.exif_transpose(image)
        image.thumbnail((240, 160))
        output = io.BytesIO()
        image.convert("RGBA").save(output, "WEBP", quality=75, method=2)
        return output.getvalue()


@lru_cache(maxsize=1024)
def image_digest(path: Path, modified: int, size: int) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()
