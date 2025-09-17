from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import json, threading, os
import logging
import sys

DATA_PATH = os.environ.get("DATA_PATH", "/app/data.json")
_lock = threading.Lock()

# Configure logging so logs appear on stdout and are easy to read
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG, format="%(asctime)s %(levelname)s %(name)s:%(message)s")
logger = logging.getLogger("demo")

def load_data() -> Dict[str, Any]:
    logger.debug("load_data: start; DATA_PATH=%s", DATA_PATH)
    with _lock:
        try:
            logger.debug("load_data: opening %s", DATA_PATH)
            with open(DATA_PATH, "r") as f:
                data = json.load(f)
            logger.debug("load_data: loaded top-level keys=%s", list(data.keys()) if isinstance(data, dict) else type(data))
            return data
        except FileNotFoundError:
            logger.exception("load_data: file not found: %s", DATA_PATH)
            raise
        except json.JSONDecodeError:
            logger.exception("load_data: failed to decode JSON in %s", DATA_PATH)
            raise
        except Exception:
            logger.exception("load_data: unexpected error")
            raise

def save_data(data: Dict[str, Any]):
    logger.debug("save_data: start; DATA_PATH=%s", DATA_PATH)
    with _lock:
        try:
            with open(DATA_PATH, "w") as f:
                json.dump(data, f, indent=2)
            logger.debug("save_data: wrote data; top-level keys=%s", list(data.keys()) if isinstance(data, dict) else type(data))
        except Exception:
            logger.exception("save_data: error writing to %s", DATA_PATH)
            raise

app = FastAPI(title="Machine Profiles")
logger.debug("app initialized")

class SetField(BaseModel):
    machineId: str
    fieldName: str
    fieldValue: Any

@app.get("/api/machines")
def get_all():
    logger.info("GET /api/machines called")
    data = load_data()
    machines = data.get("machines") if isinstance(data, dict) else None
    logger.info("GET /api/machines returning %d machines", len(machines) if machines else 0)
    return data

@app.get("/api/profile")
def get_profile(machineId: str):
    logger.info("GET /api/profile called machineId=%s", machineId)
    data = load_data()
    if machineId not in data.get("machines", {}):
        logger.warning("get_profile: machine not found %s", machineId)
        raise HTTPException(404, "machine not found")
    logger.debug("get_profile: returning profile for %s: %s", machineId, data.get("machines").get(machineId).get("softwareRoute"))
    return data["machines"][machineId]

@app.post("/api/profile/set")
def set_profile_field(req: SetField):
    logger.info("POST /api/profile/set called machineId=%s fieldName=%s", req.machineId, req.fieldName)
    logger.debug("POST /api/profile/set payload=%s", req.dict())
    data = load_data()
    if req.machineId not in data.get("machines", {}):
        logger.warning("set_profile_field: machine not found %s", req.machineId)
        raise HTTPException(404, "machine not found")
    logger.debug("set_profile_field: setting %s=%s for machine %s", req.fieldName, req.fieldValue, req.machineId)
    data["machines"][req.machineId][req.fieldName] = req.fieldValue
    save_data(data)
    logger.info("set_profile_field: updated machine %s field %s", req.machineId, req.fieldName)
    return {"ok": True}
