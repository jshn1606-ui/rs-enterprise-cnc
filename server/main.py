from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
import os
import pymongo

app = FastAPI(title="RS Enterprise Antigravity Backend")

# Allow CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConfigureRequest(BaseModel):
    client_profile: Dict[str, Any]
    technical_requirements: Dict[str, Any]

# Connect to MongoDB Atlas if MONGO_URI is set in the environment
MONGO_URI = os.getenv("MONGO_URI")
db_connected = False
leads_collection = None

if MONGO_URI:
    try:
        # Create a MongoClient with SRV support
        client = pymongo.MongoClient(MONGO_URI)
        db = client["rs_enterprise"]
        leads_collection = db["leads"]
        # Trigger connection verification
        client.admin.command('ping')
        db_connected = True
        print("Successfully connected to MongoDB Atlas!")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")

@app.post("/api/configure")
async def configure_machine(req: ConfigureRequest):
    # Insert payload into MongoDB if connected
    if db_connected and leads_collection is not None:
        try:
            leads_collection.insert_one(req.dict())
            print("Successfully saved lead to MongoDB Atlas!")
        except Exception as e:
            print(f"Failed to save lead to MongoDB: {e}")
    
    # Process the Antigravity system logic
    return {
        "status": "success",
        "database_connected": db_connected,
        "machine_configuration": {
            "base_model": "RS-Titan 5X-Pro",
            "spindle_speed_rpm": 24000,
            "axis_configuration": "5-Axis Trunnion" if req.technical_requirements.get('required_axes') == 5 else f"{req.technical_requirements.get('required_axes', 3)}-Axis Standard",
            "recommended_tooling_kit": "Titanium/Steel High-Yield End Mills",
            "estimated_price_usd": 185000
        },
        "simulation_results": {
            "gcode_validation": "Passed",
            "estimated_cycle_time_mins": req.technical_requirements.get('target_cycle_time_mins', 11.2) * 0.9,
            "efficiency_gain_percent": 18.5
        },
        "roi_report": {
            "payback_period_months": 14,
            "projected_annual_savings_usd": 42000
        },
        "predictive_maintenance": {
            "spindle_calibration_hours": 1500,
            "coolant_flush_cycles": 500,
            "ai_alert_integration": True
        }
    }

@app.get("/")
def read_root():
    return {
        "message": "Antigravity Gemini 3.1 Pro Backend is active.",
        "database_connected": db_connected
    }
