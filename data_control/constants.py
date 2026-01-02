import requests


class Constants:
    _data = {}

    @classmethod
    def req_from_over(cls) -> None:
        resp = requests.get("127.0.0.1:9100/config")
        cls._data = resp.json()  # Похуй что может упасть если честно

    @classmethod
    def get_all_const(cls) -> dict[str, str]:
        return cls._data
