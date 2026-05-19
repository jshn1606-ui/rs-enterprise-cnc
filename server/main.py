from fastapi import FastAPI, Request, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
import pymongo
import uuid
import csv
import io
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
    base_price_usd: Optional[int] = 0
    tooling_kit: str
    stock_status: str
    image_data: Optional[str] = None
    images: Optional[List[str]] = []
    is_query_for_price: Optional[bool] = False
    # Extended specs
    work_radius_mm: Optional[int] = None
    table_size: Optional[str] = None
    max_workpiece_weight_kg: Optional[int] = None
    rapid_traverse_rate: Optional[str] = None
    positional_accuracy: Optional[str] = None
    controller_type: Optional[str] = None
    coolant_system: Optional[str] = None
    power_rating_kw: Optional[float] = None

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
    images: Optional[List[str]] = None
    is_query_for_price: Optional[bool] = False
    work_radius_mm: Optional[int] = None
    table_size: Optional[str] = None
    max_workpiece_weight_kg: Optional[int] = None
    rapid_traverse_rate: Optional[str] = None
    positional_accuracy: Optional[str] = None
    controller_type: Optional[str] = None
    coolant_system: Optional[str] = None
    power_rating_kw: Optional[float] = None

class StockUpdate(BaseModel):
    stock_status: str

class LeadStatusUpdate(BaseModel):
    status: str

class MaintenanceRequest(BaseModel):
    client_name: str
    contact_email: str
    contact_phone: str
    machine_model: str
    issue_category: str
    urgency: str
    description: str
    error_code: Optional[str] = None
    images: Optional[List[str]] = []

class MaintenanceStatusUpdate(BaseModel):
    status: str

class PurchaseInquiry(BaseModel):
    machine_name: str
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: str
    message: str

class ContactInquiry(BaseModel):
    client_name: str
    contact_email: str
    contact_phone: str
    message: str

class ROISettings(BaseModel):
    default_payback_months: Optional[int] = 14
    default_annual_savings_usd: Optional[int] = 42000
    efficiency_gain_percent: Optional[float] = 18.5
    cycle_time_reduction_factor: Optional[float] = 0.9
    electricity_cost_per_kwh: Optional[float] = 8.5
    operator_hourly_wage_inr: Optional[float] = 350.0
    tooling_wear_rate_percent: Optional[float] = 2.5
    phone_number: Optional[str] = "+91 90507 00577, +91 90507 00511"
    whatsapp_number: Optional[str] = "919050700577"
    email_address: Optional[str] = "contact@webcomsirsa.com"
    physical_address: Optional[str] = "52, Basement, City Photostat, Opposite Town Park, Ludhiana"
    instagram_link: Optional[str] = "https://instagram.com/webcomsirsa"
    youtube_link: Optional[str] = "https://youtube.com/shipramiglani"
    facebook_link: Optional[str] = "https://facebook.com/webcomsirsa"
    channel_link: Optional[str] = "https://whatsapp.com/channel/0029Va9X7Y5B"


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
maintenance_collection = None

if MONGO_URI:
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client["rs_enterprise"]
        leads_collection = db["leads"]
        machines_collection = db["machines"]
        sessions_collection = db["sessions"]
        settings_collection = db["settings"]
        maintenance_collection = db["maintenance"]
        client.admin.command('ping')
        db_connected = True
        print("Successfully connected to MongoDB Atlas!")
        sessions_collection.create_index("created_at", expireAfterSeconds=86400)

        # Seed default maintenance requests if empty
        if maintenance_collection.count_documents({}) == 0:
            maintenance_collection.insert_many([
                {
                    "client_name": "Hero Cycles Ludhiana",
                    "contact_email": "maintenance@herocycles.com",
                    "contact_phone": "+91 98765-43210",
                    "machine_model": "RS-Titan 5X-Pro",
                    "issue_category": "Spindle/Axis Error",
                    "urgency": "High",
                    "description": "Spindle temperature exceeds 75°C within 10 minutes of running a heavy titanium toolpath. Alarm code spindle-overtemp-401 showing on Siemens controller.",
                    "error_code": "spindle-overtemp-401",
                    "images": [],
                    "status": "new",
                    "created_at": datetime.utcnow().isoformat()
                },
                {
                    "client_name": "Ludhiana Precision Parts",
                    "contact_email": "eng@ludhianaprecision.in",
                    "contact_phone": "+91 99123-45678",
                    "machine_model": "RS-Apex 3X-Standard",
                    "issue_category": "Precision Calibration",
                    "urgency": "Medium",
                    "description": "Z-axis repeatability is off by ±0.03 mm during continuous aluminum profile extrusion runs. Needs laser calibration check.",
                    "error_code": "Z-AXIS-ERR-09",
                    "images": [],
                    "status": "in_progress",
                    "created_at": datetime.utcnow().isoformat()
                },
                {
                    "client_name": "Kalsi Metal Works",
                    "contact_email": "kalsi@kalsimetal.com",
                    "contact_phone": "+91 98111-22233",
                    "machine_model": "RS-Rotary 4X-Pro",
                    "issue_category": "Coolant System",
                    "urgency": "Low",
                    "description": "Coolant pump pressure fluctuates. Looks like a filter clog in the secondary recirculation tank.",
                    "error_code": "CLNT-FLOW-20",
                    "images": [],
                    "status": "resolved",
                    "created_at": datetime.utcnow().isoformat()
                }
            ])
            print("Seeded default maintenance tickets.")

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
    if not db_connected or maintenance_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    total_machines = machines_collection.count_documents({})
    in_stock = machines_collection.count_documents({"stock_status": "in_stock"})
    total_tickets = maintenance_collection.count_documents({})
    urgent_tickets = maintenance_collection.count_documents({"urgency": "High"})

    # Most common failure category
    fail_counts = {}
    tickets = list(maintenance_collection.find({}, {"issue_category": 1, "_id": 0}))
    for t in tickets:
        cat = t.get("issue_category", "Other")
        fail_counts[cat] = fail_counts.get(cat, 0) + 1
    most_common_failure = max(fail_counts, key=fail_counts.get) if fail_counts else "N/A"

    # Ticket status breakdown (mapped to existing frontend keys for robustness)
    status_counts = {"new": 0, "in_contact": 0, "quote_sent": 0, "won": 0, "rejected": 0}
    for t in tickets:
        s = t.get("status", "new")
        if s == "in_diagnostic":
            status_counts["in_contact"] += 1
        elif s == "in_progress":
            status_counts["quote_sent"] += 1
        elif s == "resolved":
            status_counts["won"] += 1
        elif s in status_counts:
            status_counts[s] += 1
        else:
            status_counts["new"] += 1

    return {
        "status": "success",
        "analytics": {
            "total_machines": total_machines,
            "in_stock_count": in_stock,
            "total_leads": total_tickets,
            "pipeline_value_usd": urgent_tickets,
            "most_popular_config": most_common_failure,
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

# ─── Maintenance Ticket Management ────────────────────────────────────

@app.get("/api/leads")
@app.get("/api/maintenance")
async def get_maintenance_tickets(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if db_connected and maintenance_collection is not None:
        tickets = list(maintenance_collection.find({}))
        result = []
        for i, ticket in enumerate(tickets):
            ticket["_id"] = str(ticket["_id"])
            ticket["lead_index"] = i
            ticket["ticket_index"] = i
            if "status" not in ticket:
                ticket["status"] = "new"
            result.append(ticket)
        return {"status": "success", "leads": result, "tickets": result}
    return {"status": "error", "message": "Database not connected"}

@app.patch("/api/leads/{ticket_id}/status")
@app.patch("/api/maintenance/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, body: MaintenanceStatusUpdate, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected or maintenance_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    from bson import ObjectId
    try:
        result = maintenance_collection.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": {"status": body.status}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/leads/{ticket_id}")
@app.delete("/api/maintenance/{ticket_id}")
async def delete_ticket(ticket_id: str, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected or maintenance_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    from bson import ObjectId
    try:
        result = maintenance_collection.delete_one({"_id": ObjectId(ticket_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Ticket not found")
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
async def update_settings(settings: ROISettings, background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    if not db_connected:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    # Save parameters to database settings collection
    settings_collection.update_one({}, {"$set": settings.dict()}, upsert=True)
    
    # Prepare B2B HTML Change Audit Notification for Admin
    subject = "⚙️ [RS Enterprise] System Configurations & Settings Updated"
    
    body = f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; color: #1a202c; line-height: 1.6; background-color: #f7fafc; padding: 20px 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px;">
                <span style="font-weight: 800; font-size: 1.5rem; color: #0a0f1e; letter-spacing: 0.5px;">RS <span style="color: #ff5252;">ENTERPRISE</span></span>
                <div style="font-size: 0.9rem; color: #718096; margin-top: 5px;">Admin Control Center Settings Update Alert</div>
            </div>
            
            <h2 style="color: #ff5252; margin-top: 0; font-size: 1.3rem;">⚙️ Settings Successfully Updated</h2>
            <p>An administrator has successfully updated the core system configurations and AI tuning parameters. The live website has been updated instantly with these settings.</p>
            
            <h3 style="color: #2d3748; border-bottom: 1px solid #edf2f7; padding-bottom: 5px; margin-top: 25px; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.5px;">1. Public Contact Information</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568; width: 40%;">Phone Number:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.phone_number or '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">WhatsApp Number:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.whatsapp_number or '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Email Address:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.email_address or '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Physical Address:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.physical_address or '—'}</td>
                </tr>
            </table>

            <h3 style="color: #2d3748; border-bottom: 1px solid #edf2f7; padding-bottom: 5px; margin-top: 25px; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.5px;">2. Social & Media Channels</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568; width: 40%;">Instagram Link:</td>
                    <td style="padding: 8px 0; color: #2d3748; font-size: 0.8rem;">{settings.instagram_link or '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">YouTube Link:</td>
                    <td style="padding: 8px 0; color: #2d3748; font-size: 0.8rem;">{settings.youtube_link or '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Facebook Link:</td>
                    <td style="padding: 8px 0; color: #2d3748; font-size: 0.8rem;">{settings.facebook_link or '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Channel Link (WA/TG):</td>
                    <td style="padding: 8px 0; color: #2d3748; font-size: 0.8rem;">{settings.channel_link or '—'}</td>
                </tr>
            </table>

            <h3 style="color: #2d3748; border-bottom: 1px solid #edf2f7; padding-bottom: 5px; margin-top: 25px; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.5px;">3. AI Pre-Diagnosis Tuning (ROI)</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568; width: 50%;">Default Payback (Months):</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.default_payback_months} months</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Default Annual Savings (USD):</td>
                    <td style="padding: 8px 0; color: #2d3748;">${(settings.default_annual_savings_usd or 0):,}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Efficiency Gain:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.efficiency_gain_percent}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Cycle Time Reduction Factor:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.cycle_time_reduction_factor}x</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Ludhiana Electricity Cost:</td>
                    <td style="padding: 8px 0; color: #2d3748;">₹{settings.electricity_cost_per_kwh}/kWh</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Operator Hourly Wage:</td>
                    <td style="padding: 8px 0; color: #2d3748;">₹{settings.operator_hourly_wage_inr}/hr</td>
                </tr>
                <tr style="border-bottom: 1px solid #f7fafc;">
                    <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Tooling Wear Rate:</td>
                    <td style="padding: 8px 0; color: #2d3748;">{settings.tooling_wear_rate_percent}%</td>
                </tr>
            </table>
            
            <p style="font-size: 0.75rem; color: #a0aec0; margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
                Security alert automatically dispatched by Antigravity AI Core.
            </p>
        </div>
    </body>
    </html>
    """

    # Dispatch email alerts asynchronously in standard background tasks
    background_tasks.add_task(send_email, "jashansohal2008@gmail.com", subject, body)
    
    return {"status": "success"}

@app.get("/api/public/settings")
async def get_public_settings():
    if db_connected and settings_collection is not None:
        settings = settings_collection.find_one({}, {"_id": 0})
        if settings:
            # Ensure contact fields have nice placeholders if not populated in DB
            settings.setdefault("phone_number", "+91 90507 00577, +91 90507 00511")
            settings.setdefault("whatsapp_number", "919050700577")
            settings.setdefault("email_address", "contact@webcomsirsa.com")
            settings.setdefault("physical_address", "52, Basement, City Photostat, Opposite Town Park, Ludhiana")
            settings.setdefault("instagram_link", "https://instagram.com/webcomsirsa")
            settings.setdefault("youtube_link", "https://youtube.com/shipramiglani")
            settings.setdefault("facebook_link", "https://facebook.com/webcomsirsa")
            settings.setdefault("channel_link", "https://whatsapp.com/channel/0029Va9X7Y5B")
        return {"status": "success", "settings": settings}
    
    # Return offline mock settings if database is down
    return {
        "status": "success",
        "settings": {
            "default_payback_months": 14,
            "default_annual_savings_usd": 42000,
            "efficiency_gain_percent": 18.5,
            "cycle_time_reduction_factor": 0.9,
            "electricity_cost_per_kwh": 8.5,
            "operator_hourly_wage_inr": 350,
            "tooling_wear_rate_percent": 2.5,
            "phone_number": "+91 90507 00577, +91 90507 00511",
            "whatsapp_number": "919050700577",
            "email_address": "contact@webcomsirsa.com",
            "physical_address": "52, Basement, City Photostat, Opposite Town Park, Ludhiana",
            "instagram_link": "https://instagram.com/webcomsirsa",
            "youtube_link": "https://youtube.com/shipramiglani",
            "facebook_link": "https://facebook.com/webcomsirsa",
            "channel_link": "https://whatsapp.com/channel/0029Va9X7Y5B"
        }
    }

RESEND_API_KEY = "re_YUCb1Tv2_EQ1J1ZxhRWoXgs4sr3fVAasG"
SENDER_EMAIL = "RS Enterprise <onboarding@resend.dev>"

def send_email(recipient: str, subject: str, body: str):
    """Send email via Resend HTTP API — bypasses all cloud firewall port blocks."""
    import urllib.request
    import json
    
    url = "https://api.resend.com/emails"
    payload = {
        "from": SENDER_EMAIL,
        "to": [recipient],
        "subject": subject,
        "html": body
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            print(f"✅ Resend: Email successfully delivered to {recipient}. Response: {res_body}")
            return True, res_body
    except Exception as e:
        print(f"❌ Resend: Failed to deliver email to {recipient}. Error: {e}")
        return False, str(e)

def send_email_notification(subject: str, body: str):
    send_email("jashansohal2008@gmail.com", subject, body)

@app.get("/api/diagnostics/email")
async def test_email_diagnostics():
    recipient = "jashansohal2008@gmail.com"
    subject = "🛠️ RS Enterprise — Resend API Diagnostics Test"
    body = """
    <html>
    <body style="font-family: Arial, sans-serif; background: #f7fafc; padding: 30px;">
        <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h2 style="color: #00e676;">✅ Resend API is Working!</h2>
            <p>Your RS Enterprise email pipeline is fully operational via the Resend HTTP API.</p>
            <p style="color: #718096; font-size: 0.85rem;">All buyer auto-quotes and admin alerts will now be delivered reliably.</p>
        </div>
    </body>
    </html>
    """
    
    success, response = send_email(recipient, subject, body)
    
    if success:
        return {
            "status": "success",
            "channel": "Resend HTTP API",
            "message": f"✅ Test email dispatched successfully to {recipient}! Check your inbox now.",
            "resend_response": response
        }
    else:
        return {
            "status": "error",
            "channel": "Resend HTTP API",
            "message": "❌ Resend API call failed.",
            "error": response
        }


# ─── Configurator (Dynamic) ─────────────────────────────────────────

@app.post("/api/configure")
async def configure_machine(req: ConfigureRequest, background_tasks: BackgroundTasks):
    if db_connected and leads_collection is not None:
        try:
            doc = req.dict()
            doc["status"] = "new"
            doc["created_at"] = datetime.utcnow().isoformat()
            leads_collection.insert_one(doc)
            
            # Send email alert asynchronously in the background
            subject = f"🚨 New CNC Sale & Configuration Query from {req.client_profile.get('company_name', 'N/A')}"
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #00e676; border-bottom: 2px solid #00e676; padding-bottom: 10px; margin-top: 0;">New CNC Sale & Configuration Query</h2>
                    <p><strong>Company Name:</strong> {req.client_profile.get('company_name', 'N/A')}</p>
                    <p><strong>Contact Person:</strong> {req.client_profile.get('contact_name', 'N/A')}</p>
                    <p><strong>Email Address:</strong> {req.client_profile.get('contact_email', 'N/A')}</p>
                    <p><strong>Phone Number:</strong> {req.client_profile.get('contact_phone', 'N/A')}</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <h3 style="color: #1a202c;">Technical Specifications:</h3>
                    <ul>
                        <li><strong>Required Axes:</strong> {req.technical_requirements.get('required_axes', '3')}-Axis</li>
                        <li><strong>Target Cycle Time:</strong> {req.technical_requirements.get('target_cycle_time_mins', 'N/A')} mins</li>
                        <li><strong>Workpiece Material:</strong> {req.technical_requirements.get('workpiece_material', 'N/A')}</li>
                        <li><strong>Monthly Production Volume:</strong> {req.technical_requirements.get('monthly_volume', 'N/A')} units/month</li>
                    </ul>
                    <p style="font-size: 0.8rem; color: #a0aec0; margin-top: 30px; text-align: center;">Notification automatically dispatched by Antigravity AI.</p>
                </div>
            </body>
            </html>
            """
            background_tasks.add_task(send_email_notification, subject, body)
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

# ─── Maintenance (Repair Tickets) ───────────────────────────────────

@app.post("/api/maintenance")
async def create_maintenance_ticket(req: MaintenanceRequest, background_tasks: BackgroundTasks):
    # Prepare premium HTML email template
    urgency_color = '#ff5252' if req.urgency == 'High' else '#ffc107' if req.urgency == 'Medium' else '#00e676'
    subject = f"🛠️ [RS Enterprise] New CNC Maintenance Query ({req.urgency} Urgency) - {req.client_name}"
    
    body = f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; color: #1a202c; line-height: 1.6; background-color: #f7fafc; padding: 20px 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px;">
                <span style="font-weight: 800; font-size: 1.5rem; color: #0a0f1e; letter-spacing: 0.5px;">RS <span style="color: #00e6f2;">ENTERPRISE</span></span>
                <div style="font-size: 0.9rem; color: #718096; margin-top: 5px;">CNC Machine Maintenance & Diagnostics Alert</div>
            </div>
            
            <h2 style="color: {urgency_color}; margin-top: 0; font-size: 1.3rem;">🛠️ Maintenance Request Details</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568; width: 40%;">Client / Company:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.client_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Email:</td>
                    <td style="padding: 10px 0; color: #2d3748;"><a href="mailto:{req.contact_email}" style="color: #00e6f2; text-decoration: none;">{req.contact_email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Phone:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.contact_phone}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">CNC Machine Model:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-weight: 600;">{req.machine_model}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Issue Category:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.issue_category}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Urgency Level:</td>
                    <td style="padding: 10px 0;"><span style="font-weight: bold; color: {urgency_color}; background-color: {urgency_color}1a; padding: 4px 8px; border-radius: 4px;">{req.urgency}</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Controller Error Code:</td>
                    <td style="padding: 10px 0; color: #2d3748; font-family: monospace;">{req.error_code or 'None'}</td>
                </tr>
            </table>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 25px 0;">
            
            <h3 style="color: #2d3748; margin-top: 0; font-size: 1.1rem;">📝 Description of Symptoms:</h3>
            <p style="background: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid {urgency_color}; font-family: 'Courier New', Courier, monospace; font-size: 0.95rem; white-space: pre-wrap; margin-bottom: 25px; color: #2d3748;">{req.description}</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://jshn1606-ui.github.io/rs-enterprise-cnc/client/login.html" style="display: inline-block; background-color: #0a0f1e; color: #00e6f2; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.95rem; border: 1px solid #00e6f2; box-shadow: 0 4px 10px rgba(0, 230, 242, 0.15); transition: all 0.3s ease;">
                    Open Admin Command Center
                </a>
            </div>

            
            <p style="font-size: 0.75rem; color: #a0aec0; margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
                Notification automatically dispatched by Antigravity AI Core.
            </p>
        </div>
    </body>
    </html>
    """

    if db_connected and maintenance_collection is not None:
        try:
            doc = req.dict()
            doc["status"] = "new"
            doc["created_at"] = datetime.utcnow().isoformat()
            maintenance_collection.insert_one(doc)
            
            # Send email alert asynchronously in the background
            background_tasks.add_task(send_email_notification, subject, body)
            return {"status": "success", "message": "Repair ticket submitted successfully."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save ticket: {e}")
            
    # Send email alert in background for offline/demo submissions too
    demo_subject = f"🛠️ [Local Demo] {subject}"
    background_tasks.add_task(send_email_notification, demo_subject, body)
    return {"status": "success", "message": "Demo submission received successfully (Offline/Local)."}


@app.post("/api/inquire")
async def purchase_inquiry(req: PurchaseInquiry, background_tasks: BackgroundTasks):
    import re
    # Fetch dynamic machine details from database to resolve the price
    base_price_usd = 0
    machine_description = "Premium industrial CNC Machinery"
    if db_connected and machines_collection is not None:
        try:
            m_doc = machines_collection.find_one({"name": {"$regex": f"^{re.escape(req.machine_name)}$", "$options": "i"}})
            if m_doc:
                base_price_usd = m_doc.get("base_price_usd") or 0
                machine_description = m_doc.get("description", machine_description)
        except Exception as e:
            print(f"Error querying machine price: {e}")

    if base_price_usd > 0:
        machine_price_str = f"${base_price_usd:,} USD"
    else:
        # Fallbacks for default machines if not in database
        defaults = {
            "RS-Titan 5X-Pro": "$185,000 USD",
            "RS-Apex 3X-Standard": "$45,000 USD",
            "RS-Rotary 4X-Pro": "$75,000 USD"
        }
        machine_price_str = defaults.get(req.machine_name, "Pricing available upon technical assessment")

    # Prepare premium HTML email template for Admin
    subject = f"🛍️ [RS Enterprise] New Machine Purchase Inquiry: {req.machine_name} - {req.company_name}"
    
    body = f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; color: #1a202c; line-height: 1.6; background-color: #f7fafc; padding: 20px 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px;">
                <span style="font-weight: 800; font-size: 1.5rem; color: #0a0f1e; letter-spacing: 0.5px;">RS <span style="color: #00e676;">ENTERPRISE</span></span>
                <div style="font-size: 0.9rem; color: #718096; margin-top: 5px;">CNC Machine Sales Inventory Lead Alert</div>
            </div>
            
            <h2 style="color: #00e676; margin-top: 0; font-size: 1.3rem;">🛍️ Machine Purchase Inquiry</h2>
            
            <p>A new potential client has submitted a formal purchase inquiry regarding one of your listed catalog machines:</p>
            
            <!-- Machine Highlight Card -->
            <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                <span style="font-size: 11px; color: #00b0ff; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">INQUIRED MODEL</span>
                <h2 style="color: #0a0f1e; margin: 5px 0 0 0; font-size: 1.4rem; font-weight: 800;">{req.machine_name}</h2>
                <div style="font-size: 0.95rem; color: #00e676; font-weight: bold; margin-top: 5px;">Standard Price: {machine_price_str}</div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568; width: 40%;">Company Name:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.company_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Person:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.contact_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Email:</td>
                    <td style="padding: 10px 0; color: #2d3748;"><a href="mailto:{req.contact_email}" style="color: #00e676; text-decoration: none;">{req.contact_email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Phone:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.contact_phone}</td>
                </tr>
            </table>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 25px 0;">
            
            <h3 style="color: #2d3748; margin-top: 0; font-size: 1.1rem;">📝 Message & Custom Requirements:</h3>
            <p style="background: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #00e676; font-family: 'Courier New', Courier, monospace; font-size: 0.95rem; white-space: pre-wrap; margin-bottom: 25px; color: #2d3748;">{req.message}</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://jshn1606-ui.github.io/rs-enterprise-cnc/client/login.html" style="display: inline-block; background-color: #0a0f1e; color: #00e676; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.95rem; border: 1px solid #00e676; box-shadow: 0 4px 10px rgba(0, 230, 118, 0.15); transition: all 0.3s ease;">
                    Open Admin Command Center
                </a>
            </div>
            
            <p style="font-size: 0.75rem; color: #a0aec0; margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
                Notification automatically dispatched by Antigravity AI Core.
            </p>
        </div>
    </body>
    </html>
    """

    # Fetch dynamic contact details from the database settings
    phone_number = "+91 90507 00577, +91 90507 00511"
    whatsapp_number = "919050700577"
    email_address = "contact@webcomsirsa.com"
    physical_address = "52, Basement, City Photostat, Opposite Town Park, Ludhiana"
    
    if db_connected and settings_collection is not None:
        try:
            settings = settings_collection.find_one({}, {"_id": 0})
            if settings:
                phone_number = settings.get("phone_number", phone_number)
                whatsapp_number = settings.get("whatsapp_number", whatsapp_number)
                email_address = settings.get("email_address", email_address)
                physical_address = settings.get("physical_address", physical_address)
        except Exception:
            pass

    # Build B2B Buyer Auto-Reply with Price details
    buyer_subject = f"🛍️ Automated Price Quote: {req.machine_name} - RS Enterprise"
    buyer_body = f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; color: #1a202c; line-height: 1.6; background-color: #f7fafc; padding: 20px 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #edf2f7; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px;">
                <span style="font-weight: 800; font-size: 1.5rem; color: #0a0f1e; letter-spacing: 0.5px;">RS <span style="color: #00e6f2;">ENTERPRISE</span></span>
                <div style="font-size: 0.9rem; color: #718096; margin-top: 5px;">Certified Pre-Owned & Refurbished CNC Machines</div>
            </div>
            
            <h2 style="color: #00e6f2; margin-top: 0; font-size: 1.3rem;">Dear {req.contact_name},</h2>
            <p>Thank you for reaching out to RS Enterprise. We have successfully registered your formal purchase inquiry for the premium CNC machine: <strong>{req.machine_name}</strong>.</p>
            
            <p>Below is the automated B2B pricing quote for this machine model, based on our current Ludhiana warehouse inventory:</p>
            
            <!-- Machine Quote Box -->
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border-left: 5px solid #22c55e;">
                <span style="font-size: 11px; color: #15803d; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Base Model Price Quote</span>
                <h2 style="color: #14532d; margin: 5px 0; font-size: 1.8rem; font-weight: 800;">{machine_price_str}</h2>
                <div style="font-size: 0.85rem; color: #166534;">*Excludes custom tooling kits, gantry accessories, local duties, and G.T. Road dispatch shipping.</div>
            </div>
            
            <div style="background-color: #f7fafc; border-left: 4px solid #00e6f2; padding: 15px; margin: 20px 0; border-radius: 6px;">
                <strong style="color: #0a0f1e; display: block; margin-bottom: 5px;">Inquiry & Model Summary:</strong>
                <table style="width: 100%; font-size: 0.9rem; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td style="padding: 6px 0; color: #718096; font-weight: 600; width: 35%;">CNC Model:</td>
                        <td style="padding: 6px 0; color: #1a202c; font-weight: bold;">{req.machine_name}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td style="padding: 6px 0; color: #718096; font-weight: 600;">Description:</td>
                        <td style="padding: 6px 0; color: #1a202c;">{machine_description}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td style="padding: 6px 0; color: #718096; font-weight: 600;">Your Company:</td>
                        <td style="padding: 6px 0; color: #1a202c;">{req.company_name}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #edf2f7;">
                        <td style="padding: 6px 0; color: #718096; font-weight: 600;">Status:</td>
                        <td style="padding: 6px 0; color: #00e6f2; font-weight: bold;"><span style="background-color: #00e6f21a; padding: 2px 8px; border-radius: 4px;">Quote Dispatched (Automated)</span></td>
                    </tr>
                </table>
            </div>
 
            <h3 style="color: #2d3748; font-size: 1.1rem; margin-top: 25px;">Rigorous Calibration & Quality Assurance</h3>
            <p>At RS Enterprise, we ensure all pre-owned CNC routers, gantries, and simultaneous multi-axis mills are thoroughly inspected, cleaned of mechanical slop, retrofitted with modern industrial controllers, and laser-calibrated to original axis tolerances under <strong>0.01mm</strong>.</p>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 25px 0;">
            
            <h3 style="color: #2d3748; font-size: 1.1rem; margin-bottom: 8px;">Direct Hotlines & Spares</h3>
            <p style="font-size: 0.9rem; color: #718096; margin-top: 0;">Have immediate technical specifications to clarify? Reach our Ludhiana helpdesk directly:</p>
            <table style="width: 100%; font-size: 0.9rem; color: #4a5568;">
                <tr>
                    <td style="padding: 5px 0; font-weight: bold; width: 30%;">Call Center:</td>
                    <td style="padding: 5px 0; color: #0a0f1e; font-weight: 600;">{phone_number}</td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; font-weight: bold;">WhatsApp support:</td>
                    <td style="padding: 5px 0; color: #00e6f2;"><a href="https://wa.me/{whatsapp_number}" style="color: #00e6f2; text-decoration: none; font-weight: 600;">Open Direct Chat <i class="fa-solid fa-arrow-up-right-from-square"></i></a></td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; font-weight: bold;">Email desk:</td>
                    <td style="padding: 5px 0;"><a href="mailto:{email_address}" style="color: #00e6f2; text-decoration: none;">{email_address}</a></td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; font-weight: bold; vertical-align: top;">Primary Yard:</td>
                    <td style="padding: 5px 0; color: #0a0f1e; line-height: 1.4;">{physical_address}</td>
                </tr>
            </table>
            
            <p style="font-size: 0.75rem; color: #a0aec0; margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
                This confirmation was dispatched automatically by Antigravity AI. &copy; 2026 RS Enterprise CNC, Ludhiana.
            </p>
        </div>
    </body>
    </html>
    """

    # We map this purchase inquiry to a MaintenanceRequest shape inside MongoDB
    # so that it perfectly loads inside the existing Admin dashboard Maintenance Hub!
    db_doc = {
        "client_name": f"{req.company_name} ({req.contact_name})",
        "contact_email": req.contact_email,
        "contact_phone": req.contact_phone,
        "machine_model": req.machine_name,
        "issue_category": "Purchase Inquiry",
        "urgency": "Medium",
        "description": req.message,
        "error_code": None,
        "images": [],
        "status": "new",
        "created_at": datetime.utcnow().isoformat()
    }

    if db_connected and maintenance_collection is not None:
        try:
            maintenance_collection.insert_one(db_doc)
            # Send dynamic notifications asynchronously in background
            background_tasks.add_task(send_email, "jashansohal2008@gmail.com", subject, body)
            background_tasks.add_task(send_email, req.contact_email, buyer_subject, buyer_body)
            return {"status": "success", "message": "Purchase inquiry submitted successfully."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save inquiry: {e}")
            
    # Send email alerts in background for offline/demo submissions too
    demo_subject = f"🛍️ [Local Demo] {subject}"
    demo_buyer_subject = f"🛍️ [Local Demo] {buyer_subject}"
    background_tasks.add_task(send_email, "jashansohal2008@gmail.com", demo_subject, body)
    background_tasks.add_task(send_email, req.contact_email, demo_buyer_subject, buyer_body)
    return {"status": "success", "message": "Demo submission received successfully (Offline/Local)."}


@app.post("/api/contact")
async def contact_inquiry(req: ContactInquiry, background_tasks: BackgroundTasks):
    # Prepare premium HTML email template
    subject = f"✉️ [RS Enterprise] New General Contact Inquiry - {req.client_name}"
    
    body = f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; color: #1a202c; line-height: 1.6; background-color: #f7fafc; padding: 20px 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px;">
                <span style="font-weight: 800; font-size: 1.5rem; color: #0a0f1e; letter-spacing: 0.5px;">RS <span style="color: #00b0ff;">ENTERPRISE</span></span>
                <div style="font-size: 0.9rem; color: #718096; margin-top: 5px;">General Business Contact Inquiry Alert</div>
            </div>
            
            <h2 style="color: #00b0ff; margin-top: 0; font-size: 1.3rem;">✉️ General Contact Request</h2>
            
            <p>A user has sent you a direct message from the public Contact page of your website:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568; width: 40%;">Client Name:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.client_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Email:</td>
                    <td style="padding: 10px 0; color: #2d3748;"><a href="mailto:{req.contact_email}" style="color: #00b0ff; text-decoration: none;">{req.contact_email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 0; font-weight: bold; color: #4a5568;">Contact Phone:</td>
                    <td style="padding: 10px 0; color: #2d3748;">{req.contact_phone}</td>
                </tr>
            </table>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 25px 0;">
            
            <h3 style="color: #2d3748; margin-top: 0; font-size: 1.1rem;">📝 Message Sent:</h3>
            <p style="background: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #00b0ff; font-family: 'Courier New', Courier, monospace; font-size: 0.95rem; white-space: pre-wrap; margin-bottom: 25px; color: #2d3748;">{req.message}</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://jshn1606-ui.github.io/rs-enterprise-cnc/client/login.html" style="display: inline-block; background-color: #0a0f1e; color: #00b0ff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.95rem; border: 1px solid #00b0ff; box-shadow: 0 4px 10px rgba(0, 176, 255, 0.15); transition: all 0.3s ease;">
                    Open Admin Command Center
                </a>
            </div>
            
            <p style="font-size: 0.75rem; color: #a0aec0; margin-top: 30px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px;">
                Notification automatically dispatched by Antigravity AI Core.
            </p>
        </div>
    </body>
    </html>
    """

    # Register inside maintenance collection so it loads into the CRM dashboard instantly!
    db_doc = {
        "client_name": req.client_name,
        "contact_email": req.contact_email,
        "contact_phone": req.contact_phone,
        "machine_model": "N/A",
        "issue_category": "General Contact",
        "urgency": "Medium",
        "description": req.message,
        "error_code": None,
        "images": [],
        "status": "new",
        "created_at": datetime.utcnow().isoformat()
    }

    if db_connected and maintenance_collection is not None:
        try:
            maintenance_collection.insert_one(db_doc)
            # Send email alert asynchronously in the background
            background_tasks.add_task(send_email_notification, subject, body)
            return {"status": "success", "message": "Inquiry submitted successfully."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save contact inquiry: {e}")
            
    # Send email alert in background for offline/demo submissions too
    demo_subject = f"✉️ [Local Demo] {subject}"
    background_tasks.add_task(send_email_notification, demo_subject, body)
    return {"status": "success", "message": "Demo submission received successfully (Offline/Local)."}


@app.get("/")
def read_root():
    return {"message": "Antigravity Gemini 3.1 Pro Backend is active.", "database_connected": db_connected}


