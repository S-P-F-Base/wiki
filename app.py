import contextlib

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from router.utils.search_index import build_index, is_index_stale
from router.wiki_index import router as wiki_index_router
from router.wiki_render import router as wiki_render_router
from template_env import LOCAL_RUN


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if is_index_stale():
        build_index()

    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

for router in [
    wiki_index_router,
    wiki_render_router,
]:
    app.include_router(router)


if LOCAL_RUN:
    app.mount(
        "/static",
        StaticFiles(directory="static"),
        name="static",
    )

    @app.get("/")
    async def redirect_to_wiki():
        return RedirectResponse(url="/wiki/")
