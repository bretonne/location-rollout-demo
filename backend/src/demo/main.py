from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import json, threading, os
import logging
import sys
import time
from datetime import datetime

DATA_PATH = os.environ.get("DATA_PATH", "/app/data.json")
_lock = threading.Lock()
_cache_lock = threading.Lock()
_cached_data: Dict[str, Any] = None
_last_reload = 0
RELOAD_INTERVAL = 60  # seconds

# Configure logging so logs appear on stdout and are easy to read
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG, format="%(asctime)s %(levelname)s %(name)s:%(message)s")
logger = logging.getLogger("demo")

def load_data_from_file() -> Dict[str, Any]:
    """Load data directly from the file without caching."""
    logger.debug("load_data_from_file: start; DATA_PATH=%s", DATA_PATH)
    with _lock:
        try:
            logger.debug("load_data_from_file: opening %s", DATA_PATH)
            with open(DATA_PATH, "r") as f:
                data = json.load(f)
            logger.debug("load_data_from_file: loaded top-level keys=%s", list(data.keys()) if isinstance(data, dict) else type(data))
            return data
        except FileNotFoundError:
            logger.exception("load_data_from_file: file not found: %s", DATA_PATH)
            raise
        except json.JSONDecodeError:
            logger.exception("load_data_from_file: failed to decode JSON in %s", DATA_PATH)
            raise
        except Exception:
            logger.exception("load_data_from_file: unexpected error")
            raise

def save_data(data: Dict[str, Any]):
    """Save data to file and also update the internal cache."""
    logger.debug("save_data: start; DATA_PATH=%s", DATA_PATH)
    with _lock:
        try:
            with open(DATA_PATH, "w") as f:
                json.dump(data, f, indent=2)
            logger.debug("save_data: wrote data; top-level keys=%s", list(data.keys()) if isinstance(data, dict) else type(data))

            # Update internal cache
            with _cache_lock:
                global _cached_data, _last_reload
                _cached_data = data.copy()
                _last_reload = time.time()
            logger.debug("save_data: updated internal cache")

        except Exception:
            logger.exception("save_data: error writing to %s", DATA_PATH)
            raise

def get_cached_data() -> Dict[str, Any]:
    """Get data from cache, reloading from file if needed."""
    global _cached_data, _last_reload  # Declare both globals at the start

    current_time = time.time()
    should_reload = (current_time - _last_reload) >= RELOAD_INTERVAL

    with _cache_lock:
        if _cached_data is None or should_reload:
            logger.debug("get_cached_data: cache miss or reload needed, loading from file")
            try:
                _cached_data = load_data_from_file()
                _last_reload = current_time
                logger.info("get_cached_data: successfully reloaded data from file at %s", datetime.fromtimestamp(current_time))
            except Exception as e:
                logger.error("get_cached_data: failed to reload from file: %s", str(e))
                # If we can't load fresh data, return cached data if available
                if _cached_data is None:
                    raise
                else:
                    logger.warning("get_cached_data: using stale cached data due to reload failure")

        return _cached_data.copy()  # Return a copy to prevent external modification

def initialize_cache():
    """Initialize the cache on startup."""
    global _cached_data, _last_reload
    try:
        logger.info("initialize_cache: loading initial data from %s", DATA_PATH)
        _cached_data = load_data_from_file()
        _last_reload = time.time()
        logger.info("initialize_cache: cache initialized with %d machines",
                    len(_cached_data.get("machines", {})) if _cached_data else 0)
    except Exception as e:
        logger.error("initialize_cache: failed to initialize cache: %s", str(e))
        _cached_data = {"machines": {}}
        _last_reload = time.time()

app = FastAPI(title="Machine Profiles")
logger.debug("app initialized")

class SetField(BaseModel):
    machineId: str
    fieldName: str
    fieldValue: Any

@app.on_event("startup")
async def startup_event():
    """Initialize cache on application startup."""
    initialize_cache()

@app.get("/api/machines")
def get_all():
    logger.info("GET /api/machines called")
    data = get_cached_data()
    machines = data.get("machines") if isinstance(data, dict) else None
    logger.info("GET /api/machines returning %d machines", len(machines) if machines else 0)
    return data

@app.get("/api/profile")
def get_profile(machineId: str):
    logger.info("GET /api/profile called machineId=%s", machineId)
    data = get_cached_data()
    if machineId not in data.get("machines", {}):
        logger.warning("get_profile: machine not found %s", machineId)
        raise HTTPException(404, "machine not found")
    logger.debug("get_profile: returning profile for %s: %s",
                 machineId, data.get("machines").get(machineId).get("softwareRoute"))
    return data["machines"][machineId]

@app.post("/api/profile/set")
def set_profile_field(req: SetField):
    logger.info("POST /api/profile/set called machineId=%s fieldName=%s", req.machineId, req.fieldName)
    logger.debug("POST /api/profile/set payload=%s", req.dict())

    # Get current data (this will reload if needed)
    data = get_cached_data()

    if req.machineId not in data.get("machines", {}):
        logger.warning("set_profile_field: machine not found %s", req.machineId)
        raise HTTPException(404, "machine not found")

    logger.debug("set_profile_field: setting %s=%s for machine %s", req.fieldName, req.fieldValue, req.machineId)
    data["machines"][req.machineId][req.fieldName] = req.fieldValue

    # Save to file and update cache
    save_data(data)
    logger.info("set_profile_field: updated machine %s field %s", req.machineId, req.fieldName)
    return {"ok": True}

@app.get("/api/cache/status")
def get_cache_status():
    """Get current cache status for monitoring."""
    global _cached_data, _last_reload
    with _cache_lock:
        cache_age = time.time() - _last_reload
        return {
            "cache_age_seconds": cache_age,
            "last_reload": datetime.fromtimestamp(_last_reload).isoformat() if _last_reload > 0 else None,
            "machines_count": len(_cached_data.get("machines", {})) if _cached_data else 0,
            "needs_reload": cache_age >= RELOAD_INTERVAL
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)