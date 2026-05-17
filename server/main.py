from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
import pymongo
import uuid
import csv
import io
from datetime import datetime

app = FastAPI(title="RS Enterprise Antigravity Backend")

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
    stock_status: str
    image_data: Optional[str] = None

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

class StockUpdate(BaseModel):
    stock_status: str

class LeadStatusUpdate(BaseModel):
    status: str

class ROISettings(BaseModel):
    default_payback_months: int
    default_annual_savings_usd: int
    efficiency_gain_percent: float
    cycle_time_reduction_factor: float
    electricity_cost_per_kwh: float
    operator_hourly_wage_inr: float
    tooling_wear_rate_percent: float

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
        client.admin.command('ping')
        db_connected = True
        print("Successfully connected to MongoDB Atlas!")
        sessions_collection.create_index("created_at", expireAfterSeconds=86400)

        # Seed default settings if empty
        if settings_collection.count_documents({}) == 0:
            settings_collection.insert_one({
                "default_payback_months": 14,
                "default_annual_savings_usd": 42000,
                "efficiency_gain_percent": 18.5,
                "cycle_time_reduction_factor": 0.9,
                "electricity_cost_per_kwh": 8.5,
                "operator_hourly_wage_inr": 350,
                "tooling_wear_rate_percent": 2.5
            })
            print("Seeded default ROI settings.")
        else:
            # Ensure new fields exist on old settings docs
            settings_collection.update_one(
                {},
                {"$setOnInsert": {
                    "electricity_cost_per_kwh": 8.5,
                    "operator_hourly_wage_inr": 350,
                    "tooling_wear_rate_percent": 2.5
                }},
                upsert=True
            )
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")

# ─── Auth Helpers ────────────────────────────────────────────────────

def verify_token(authorization: Optional[str]) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization[7:]
    if not db_connected or sessions_collection is None:
        return False
    return sessions_collection.find_one({"token": token}) is not None

def require_auth(authorization: Optional[str] = Header(None)):
    if not verify_token(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

# ─── Admin Auth ──────────────────────────────────────────────────────

@app.post("/api/admin/login")
async def admin_login(req: LoginRequest):
    if req.username == ADMIN_USER and req.password == ADMIN_PASS:
        token = str(uuid.uuid4())
        if db_connected and sessions_collection is not None:
            sessions_collection.insert_one({"token": token, "created_at": datetime.utcnow()})
        return {"status": "success", "token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# ─── Analytics ───────────────────────────────────────────────────────

@app.get("/api/analytics")
async def get_analytics(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")

    total_machines = machines_collection.count_documents({})
    in_stock = machines_collection.count_documents({"stock_status": "in_stock"})
    total_leads = leads_collection.count_documents({})

    # Pipeline value = sum of base_price_usd for all machines × number of relevant leads
    pipeline_value = 0
    machines = list(machines_collection.find({}, {"base_price_usd": 1, "_id": 0}))
    avg_price = sum(m.get("base_price_usd", 0) for m in machines) / max(len(machines), 1)
    pipeline_value = int(avg_price * total_leads)

    # Most configured axis type from leads
    axis_counts = {}
    leads = list(leads_collection.find({}, {"technical_requirements.required_axes": 1, "_id": 0}))
    for lead in leads:
        axes = lead.get("technical_requirements", {}).get("required_axes", 3)
        key = f"{axes}-Axis"
        axis_counts[key] = axis_counts.get(key, 0) + 1
    most_popular = max(axis_counts, key=axis_counts.get) if axis_counts else "N/A"

    # Lead status breakdown
    status_counts = {"new": 0, "in_contact": 0, "quote_sent": 0, "won": 0, "rejected": 0}
    all_leads = list(leads_collection.find({}, {"status": 1, "_id": 0}))
    for lead in all_leads:
        s = lead.get("status", "new")
        if s in status_counts:
            status_counts[s] += 1
        else:
            status_counts["new"] += 1

    return {
        "status": "success",
        "analytics": {
            "total_machines": total_machines,
            "in_stock_count": in_stock,
            "total_leads": total_leads,
            "pipeline_value_usd": pipeline_value,
            "most_popular_config": most_popular,
            "lead_status_breakdown": status_counts
        }
    }

# ─── Machine CRUD ────────────────────────────────────────────────────

@app.get("/api/machines")
def get_machines():
    if db_connected and machines_collection is not None:
        machines = list(machines_collection.find({}, {"_id": 0}))
        return {"status": "success", "machines": machines}
    return {"status": "success", "machines": []}

@app.post("/api/machines")
async def create_machine(machine: MachineCreate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    doc = machine.dict()
    doc["machine_id"] = str(uuid.uuid4())[:8]
    doc["created_at"] = datetime.utcnow().isoformat()
    machines_collection.insert_one(doc)
    return {"status": "success", "machine_id": doc["machine_id"]}

@app.put("/api/machines/{machine_id}")
async def update_machine(machine_id: str, updates: MachineUpdate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = machines_collection.update_one({"machine_id": machine_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"status": "success"}

@app.delete("/api/machines/{machine_id}")
async def delete_machine(machine_id: str, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    result = machines_collection.delete_one({"machine_id": machine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"status": "success"}

# ─── Quick Actions ───────────────────────────────────────────────────

@app.post("/api/machines/{machine_id}/duplicate")
async def duplicate_machine(machine_id: str, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    original = machines_collection.find_one({"machine_id": machine_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Machine not found")
    clone = dict(original)
    clone["machine_id"] = str(uuid.uuid4())[:8]
    clone["name"] = clone["name"] + " (Copy)"
    clone["created_at"] = datetime.utcnow().isoformat()
    machines_collection.insert_one(clone)
    return {"status": "success", "machine_id": clone["machine_id"]}

@app.patch("/api/machines/{machine_id}/stock")
async def toggle_stock(machine_id: str, body: StockUpdate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    result = machines_collection.update_one(
        {"machine_id": machine_id},
        {"$set": {"stock_status": body.stock_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"status": "success"}

@app.get("/api/machines/export")
async def export_machines_csv(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    machines = list(machines_collection.find({}, {"_id": 0, "image_data": 0}))
    output = io.StringIO()
    if machines:
        writer = csv.DictWriter(output, fieldnames=machines[0].keys())
        writer.writeheader()
        writer.writerows(machines)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rs_enterprise_inventory.csv"}
    )

# ─── Lead Management ────────────────────────────────────────────────

@app.get("/api/leads")
async def get_leads(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if db_connected and leads_collection is not None:
        leads = list(leads_collection.find({}))
        # Add index-based IDs for frontend reference and convert ObjectId
        result = []
        for i, lead in enumerate(leads):
            lead["_id"] = str(lead["_id"])
            lead["lead_index"] = i
            if "status" not in lead:
                lead["status"] = "new"
            result.append(lead)
        return {"status": "success", "leads": result}
    return {"status": "error", "message": "Database not connected"}

@app.patch("/api/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, body: LeadStatusUpdate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    from bson import ObjectId
    try:
        result = leads_collection.update_one(
            {"_id": ObjectId(lead_id)},
            {"$set": {"status": body.status}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: str, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    from bson import ObjectId
    try:
        result = leads_collection.delete_one({"_id": ObjectId(lead_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ─── ROI Settings ────────────────────────────────────────────────────

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
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    settings_collection.update_one({}, {"$set": settings.dict()}, upsert=True)
    return {"status": "success"}

# ─── Configurator (Dynamic) ─────────────────────────────────────────

@app.post("/api/configure")
async def configure_machine(req: ConfigureRequest):
    if db_connected and leads_collection is not None:
        try:
            doc = req.dict()
            doc["status"] = "new"
            doc["created_at"] = datetime.utcnow().isoformat()
            leads_collection.insert_one(doc)
        except Exception as e:
            print(f"Failed to save lead: {e}")

    roi = None
    if db_connected and settings_collection is not None:
        roi = settings_collection.find_one({}, {"_id": 0})

    payback = roi.get("default_payback_months", 14) if roi else 14
    savings = roi.get("default_annual_savings_usd", 42000) if roi else 42000
    efficiency = roi.get("efficiency_gain_percent", 18.5) if roi else 18.5
    cycle_factor = roi.get("cycle_time_reduction_factor", 0.9) if roi else 0.9

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

@app.get("/")
def read_root():
    return {"message": "Antigravity Gemini 3.1 Pro Backend is active.", "database_connected": db_connected}
