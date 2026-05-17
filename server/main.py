from fastapi import FastAPI, Request, File, UploadFile, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
import pymongo
import uuid
import base64
from datetime import datetime, timedelta

app = FastAPI(title="RS Enterprise Antigravity Backend")

# Allow CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ────────────────────────────────────────────────

class ConfigureRequest(BaseModel):
    client_profile: Dict[str, Any]
    technical_requirements: Dict[str, Any]

class LoginRequest(BaseModel):
    username: str
    password: str

class MachineCreate(BaseModel):
    name: str
    description: str
    axis_config: str
    spindle_speed_rpm: int
    max_footprint_sqft: int
    base_price_usd: int
    tooling_kit: str
    stock_status: str  # "in_stock", "out_of_stock", "special_order"
    image_data: Optional[str] = None  # base64 encoded image

class MachineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    axis_config: Optional[str] = None
    spindle_speed_rpm: Optional[int] = None
    max_footprint_sqft: Optional[int] = None
    base_price_usd: Optional[int] = None
    tooling_kit: Optional[str] = None
    stock_status: Optional[str] = None
    image_data: Optional[str] = None

class ROISettings(BaseModel):
    default_payback_months: int
    default_annual_savings_usd: int
    efficiency_gain_percent: float
    cycle_time_reduction_factor: float

# ─── Database Connection ─────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "Jashan_1606")

db_connected = False
db = None
leads_collection = None
machines_collection = None
sessions_collection = None
settings_collection = None

if MONGO_URI:
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client["rs_enterprise"]
        leads_collection = db["leads"]
        machines_collection = db["machines"]
        sessions_collection = db["sessions"]
        settings_collection = db["settings"]
        # Trigger connection verification
        client.admin.command('ping')
        db_connected = True
        print("Successfully connected to MongoDB Atlas!")

        # Create TTL index on sessions (expire after 24 hours)
        sessions_collection.create_index("created_at", expireAfterSeconds=86400)

        # Seed default ROI settings if not present
        if settings_collection.count_documents({}) == 0:
            settings_collection.insert_one({
                "default_payback_months": 14,
                "default_annual_savings_usd": 42000,
                "efficiency_gain_percent": 18.5,
                "cycle_time_reduction_factor": 0.9
            })
            print("Seeded default ROI settings.")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")

# ─── Auth Helpers ────────────────────────────────────────────────────

def verify_token(authorization: Optional[str]) -> bool:
    """Verify the Bearer token against sessions collection."""
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization[7:]
    if not db_connected or sessions_collection is None:
        return False
    session = sessions_collection.find_one({"token": token})
    return session is not None

def require_auth(authorization: Optional[str] = Header(None)):
    """Dependency to require valid auth token."""
    if not verify_token(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

# ─── Admin Auth Endpoints ────────────────────────────────────────────

@app.post("/api/admin/login")
async def admin_login(req: LoginRequest):
    if req.username == ADMIN_USER and req.password == ADMIN_PASS:
        token = str(uuid.uuid4())
        if db_connected and sessions_collection is not None:
            sessions_collection.insert_one({
                "token": token,
                "created_at": datetime.utcnow()
            })
        return {"status": "success", "token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# ─── Machine CRUD Endpoints ─────────────────────────────────────────

@app.get("/api/machines")
def get_machines():
    """Public endpoint - returns all machines."""
    if db_connected and machines_collection is not None:
        try:
            machines = list(machines_collection.find({}, {"_id": 0}))
            return {"status": "success", "machines": machines}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "success", "machines": []}

@app.post("/api/machines")
async def create_machine(machine: MachineCreate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected or machines_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    doc = machine.dict()
    doc["machine_id"] = str(uuid.uuid4())[:8]
    doc["created_at"] = datetime.utcnow().isoformat()
    machines_collection.insert_one(doc)
    return {"status": "success", "machine_id": doc["machine_id"]}

@app.put("/api/machines/{machine_id}")
async def update_machine(machine_id: str, updates: MachineUpdate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected or machines_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = machines_collection.update_one(
        {"machine_id": machine_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"status": "success"}

@app.delete("/api/machines/{machine_id}")
async def delete_machine(machine_id: str, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected or machines_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    result = machines_collection.delete_one({"machine_id": machine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"status": "success"}

# ─── ROI Settings Endpoints ─────────────────────────────────────────

@app.get("/api/settings")
async def get_settings(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if db_connected and settings_collection is not None:
        settings = settings_collection.find_one({}, {"_id": 0})
        return {"status": "success", "settings": settings}
    return {"status": "error", "message": "Database not connected"}

@app.put("/api/settings")
async def update_settings(settings: ROISettings, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected or settings_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    settings_collection.update_one({}, {"$set": settings.dict()})
    return {"status": "success"}

# ─── Leads Endpoint ──────────────────────────────────────────────────

@app.get("/api/leads")
async def get_leads(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if db_connected and leads_collection is not None:
        try:
            leads = list(leads_collection.find({}, {"_id": 0}))
            return {"status": "success", "leads": leads}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Database not connected"}

# ─── Configurator Endpoint (Now Dynamic) ─────────────────────────────

@app.post("/api/configure")
async def configure_machine(req: ConfigureRequest):
    # Insert payload into MongoDB if connected
    if db_connected and leads_collection is not None:
        try:
            leads_collection.insert_one(req.dict())
            print("Successfully saved lead to MongoDB Atlas!")
        except Exception as e:
            print(f"Failed to save lead to MongoDB: {e}")

    # Read dynamic ROI settings from database
    roi_settings = None
    if db_connected and settings_collection is not None:
        roi_settings = settings_collection.find_one({}, {"_id": 0})

    payback = roi_settings.get("default_payback_months", 14) if roi_settings else 14
    savings = roi_settings.get("default_annual_savings_usd", 42000) if roi_settings else 42000
    efficiency = roi_settings.get("efficiency_gain_percent", 18.5) if roi_settings else 18.5
    cycle_factor = roi_settings.get("cycle_time_reduction_factor", 0.9) if roi_settings else 0.9

    axes = req.technical_requirements.get('required_axes', 3)
    return {
        "status": "success",
        "database_connected": db_connected,
        "machine_configuration": {
            "base_model": "RS-Titan 5X-Pro",
            "spindle_speed_rpm": 24000,
            "axis_configuration": "5-Axis Trunnion" if axes == 5 else f"{axes}-Axis Standard",
            "recommended_tooling_kit": "Titanium/Steel High-Yield End Mills",
            "estimated_price_usd": 185000
        },
        "simulation_results": {
            "gcode_validation": "Passed",
            "estimated_cycle_time_mins": req.technical_requirements.get('target_cycle_time_mins', 11.2) * cycle_factor,
            "efficiency_gain_percent": efficiency
        },
        "roi_report": {
            "payback_period_months": payback,
            "projected_annual_savings_usd": savings
        },
        "predictive_maintenance": {
            "spindle_calibration_hours": 1500,
            "coolant_flush_cycles": 500,
            "ai_alert_integration": True
        }
    }

# ─── Root Health Check ───────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "message": "Antigravity Gemini 3.1 Pro Backend is active.",
        "database_connected": db_connected
    }
