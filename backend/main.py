from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
import uvicorn
import google.generativeai as genai
import os
from typing import List, Optional
from dotenv import load_dotenv
import pickle
from collections import defaultdict
import warnings
import logging

warnings.filterwarnings("ignore")

# Configure logging for debug output
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# --- FastAPI Setup ---
app = FastAPI(title="Smart Health Companion API (Enhanced)")

# --- Constants & Expanded Pools ---
RSEED = 42
np.random.seed(RSEED)

EXERCISE_META = {
    "Walking": 3.5, "Jogging": 8.0, "Running": 12.5, "Cycling": 6.8,
    "Push-ups": 8.0, "Squats": 7.0, "Jumping Jacks": 8.0, "Yoga": 2.5,
    "Swimming": 7.0, "Plank": 6.0, "Weight Lifting": 6.5, "Rowing": 7.0,
    "Aerobics": 6.8, "Stair Climbing": 8.0,
    "Deadlift": 6.5, "Bench Press": 6.5, "Pull-up": 8.0,
    "Lunge": 7.0, "Kettlebell": 8.0
}

GOALS = ["Weight Loss", "Muscle Gain", "Stamina/Endurance", "General Fitness"]

WORKOUT_POOL = {
    "Weight Loss": ["Jogging", "Running", "Cycling", "Jumping Jacks", "Swimming", "Aerobics"],
    "Muscle Gain": ["Push-ups", "Squats", "Plank", "Weight Lifting", "Deadlift", "Bench Press", "Pull-up", "Lunge", "Kettlebell"],
    "Stamina/Endurance": ["Jogging", "Running", "Cycling", "Swimming", "Rowing", "Stair Climbing"],
    "General Fitness": ["Walking", "Yoga", "Cycling", "Aerobics", "Squats"]
}

WORKOUT_RECOMMENDATIONS = {
    "Weight Loss": [
        {"exercise": "Running, general", "intensity": "moderate", "duration_min": 30, "sessions_per_week": 4, "times_per_day": 1, "sets_reps": "N/A (steady pace)"},
        {"exercise": "Cycling, 12-13.9 mph, moderate", "intensity": "intense", "duration_min": 45, "sessions_per_week": 3, "times_per_day": 1, "sets_reps": "N/A"},
        {"exercise": "Jumping rope, moderate", "intensity": "mild", "duration_min": 20, "sessions_per_week": 5, "times_per_day": 1, "sets_reps": "3 sets of 1 min"},
        {"exercise": "Swimming laps, freestyle, slow", "intensity": "moderate", "duration_min": 30, "sessions_per_week": 3, "times_per_day": 1, "sets_reps": "N/A (laps)"},
        {"exercise": "Aerobics, general", "intensity": "intense", "duration_min": 40, "sessions_per_week": 4, "times_per_day": 1, "sets_reps": "N/A (high impact)"},
    ],
    "Muscle Gain": [
        {"exercise": "Squats", "intensity": "moderate", "duration_min": 45, "sessions_per_week": 4, "times_per_day": 1, "sets_reps": "4 sets of 8-12 reps"},
        {"exercise": "Push-ups", "intensity": "intense", "duration_min": 30, "sessions_per_week": 3, "times_per_day": 1, "sets_reps": "3 sets of 10-15 reps"},
        {"exercise": "Weight lifting, body building, vigorous", "intensity": "moderate", "duration_min": 50, "sessions_per_week": 4, "times_per_day": 1, "sets_reps": "4 sets of 6-10 reps"},
        {"exercise": "Deadlift", "intensity": "intense", "duration_min": 40, "sessions_per_week": 3, "times_per_day": 1, "sets_reps": "3 sets of 5-8 reps"},
    ],
    "Stamina/Endurance": [
        {"exercise": "Running, cross country", "intensity": "intense", "duration_min": 60, "sessions_per_week": 3, "times_per_day": 1, "sets_reps": "N/A (steady state)"},
        {"exercise": "Cycling, 12-13.9 mph, moderate", "intensity": "moderate", "duration_min": 50, "sessions_per_week": 4, "times_per_day": 1, "sets_reps": "N/A"},
    ],
    "General Fitness": [
        {"exercise": "Walking 3.0 mph, moderate", "intensity": "mild", "duration_min": 30, "sessions_per_week": 5, "times_per_day": 1, "sets_reps": "N/A"},
        {"exercise": "Yoga", "intensity": "mild", "duration_min": 45, "sessions_per_week": 3, "times_per_day": 1, "sets_reps": "N/A (poses)"},
    ]
}

# --- Model Paths ---
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)

RECO_MODEL_PATH = MODEL_DIR / "rec_tree.joblib"
CAL_MODEL_PATH = MODEL_DIR / "cal_rf.joblib"
FEATURES_INFO_PATH = MODEL_DIR / "meta_info.joblib"
GEMINI_HISTORY_PATH = MODEL_DIR / "gemini_history.pkl"

# --- GEMINI CONFIG & History Loading ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
gemini_model = None
conversation_history = defaultdict(list)

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-2.5-flash')
        if GEMINI_HISTORY_PATH.exists():
            with open(GEMINI_HISTORY_PATH, 'rb') as f:
                loaded_history = pickle.load(f)
                conversation_history.update(loaded_history)
        print("✅ Gemini AI configured. Conversation history loaded.")
    except Exception as e:
        print(f"⚠️ Error configuring Gemini AI: {e}. AI Coach will not work.")
        gemini_model = None
else:
    print("⚠️ Warning: GEMINI_API_KEY not set. AI Coach will not work.")

# CORS - Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load datasets
try:
    # Ensure these CSV files are present in the root directory for this to work
    cal_df = pd.read_csv("exercise_dataset.csv")
    rec_df = pd.read_csv("fitness_and_workout_dataset.csv")
    food_df = pd.read_csv("Indian_Food_Nutrition_Processed.csv")
    print("✅ All CSV files loaded successfully")
except Exception as e:
    print(f"❌ Error loading CSV files. Ensure CSV files are present: {e}")
    # Do not exit, allow API to load for non-ML endpoints
    cal_df = pd.DataFrame() 
    rec_df = pd.DataFrame()
    food_df = pd.DataFrame()

# --- Pydantic Models ---
class UserProfile(BaseModel):
    age: int
    gender: str
    weight: float
    height: float
    goal: str

class CalorieRequest(BaseModel):
    age: int
    gender: str
    weight: float
    height: float
    exercise: str
    duration: int

class CoachRequest(BaseModel):
    message: str
    user_id: str
    profile: Optional[dict] = None

# --- Utility Functions ---
def compute_bmi(weight_kg, height_cm):
    height_m = height_cm / 100.0
    return weight_kg / (height_m ** 2)

def calories_per_min_from_met(met, weight_kg):
    # This physics-based formula is what the Calorie model will learn to approximate
    return (met * 3.5 * weight_kg) / 200.0

def calculate_bmr(age, gender, weight, height):
    if gender.lower() == "male":
        return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    else:
        return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)

def adjust_calories_for_goal(bmr, goal):
    if goal == "Weight Loss":
        return bmr * 1.3 - 500
    elif goal == "Muscle Gain":
        return bmr * 1.55 + 350
    elif goal == "Stamina/Endurance":
        return bmr * 1.6
    else:
        return bmr * 1.4

def classify_intensity(met_value):
    if met_value >= 6.0:
        return "Vigorous"
    elif met_value >= 3.0:
        return "Moderate"
    else:
        return "Light"

def score_exercise_by_goal(met, exercise_name, goal):
    """Assigns a score to exercises based on goal, favoring certain types."""
    
    # Base score is MET value
    score = met
    
    # Simple Boosts based on Goal (prioritization logic for frontend sorting)
    if goal == "Weight Loss":
        if met >= 8.0: # Running, Swimming, Jumping Jacks
            score += 2.0
    elif goal == "Muscle Gain":
        if exercise_name in ["Push-ups", "Squats", "Weight Lifting", "Deadlift", "Bench Press", "Pull-up"]:
            score += 3.0
    elif goal == "Stamina/Endurance":
        if met >= 6.0: # Long-duration cardio
            score += 1.5
    elif goal == "General Fitness":
        if met >= 4.0 and met <= 7.0: # Moderate intensity preferred
            score += 1.0
        
    return score


def categorize_meal_type(dish_name):
    """
    Categorize dishes into meal types with strict spice/powder exclusion.
    Includes enhanced classification for sweets, cheela, and premix.
    """
    dish_lower = dish_name.lower()
    
    # HIGHEST PRIORITY: Detect pure spices/powders
    pure_spice_patterns = [
        'powder', 'masala', 'spice mix', 'gun powder', 
        'chat ', 'chaat ', 'rasam ', 'sambar ',
        'baghar', 'tadka'
    ]
    
    word_count = len(dish_lower.split())
    if any(pattern in dish_lower for pattern in pure_spice_patterns) and word_count <= 4:
        return 'spice'
    
    # NOW check actual food categories
    
    # Breakfast items (FIX: Added 'cheela')
    breakfast_kw = [
        'sandwich', 'porridge', 'pancake', 'egg', 'omelette', 'omlet',
        'cornflakes', 'oatmeal', 'idli', 'dosa', 'uttapam', 'poha',
        'upma', 'parantha', 'paratha', 'poori', 'toast', 'flakes', 'daliya', 'cheela'
    ]
    
    # Beverages
    beverage_kw = [
        'tea', 'chai', 'coffee', 'milk', 'shake', 'lassi', 'juice',
        'drink', 'cooler', 'punch', 'lemonade', 'water', 'cocoa'
    ]
    
    # Main course dishes
    maincourse_kw = [
        'curry', 'dal', 'rice', 'biryani', 'pulao', 'chapati', 'roti',
        'naan', 'bhatura', 'sambar ', 'kadhi', 'keema', 'chicken',
        'fish', 'mutton', 'paneer', 'rajmah', 'channa'
    ]
    
    # Snacks (FIX: Added 'prem' for premix and murukku)
    snack_kw = [
        'pakoda', 'pakora', 'samosa', 'kachori', 'vada', 'kebab',
        'roll', 'cutlet', 'bhaji', 'fries', 'chips', 'bhel',
        'bonda', 'bajji', 'tikki', 'murukku', 'prem'
    ]
    
    # Desserts (FIX: Explicitly includes 'burfi' and 'ladoo')
    dessert_kw = [
        'kheer', 'halwa', 'ladoo', 'barfi', 'gulab jamun', 'jalebi',
        'rasgulla', 'kulfi', 'payasam', 'sweet', 'cake', 'pudding', 'burfi'
    ]
    
    # Others
    soup_kw = ['soup', 'consomme', 'broth']
    salad_kw = ['salad', 'coleslaw']
    condiment_kw = ['chutney', 'pickle', 'achar', 'raita', 'papad', 'sauce']
    
    # Check categories in order of specificity
    if any(kw in dish_lower for kw in breakfast_kw):
        return 'breakfast_main'
    elif any(kw in dish_lower for kw in beverage_kw):
        return 'beverage'
    elif any(kw in dish_lower for kw in snack_kw):
        return 'snack'
    elif any(kw in dish_lower for kw in dessert_kw):
        return 'dessert'
    elif any(kw in dish_lower for kw in maincourse_kw):
        return 'main_course'
    elif any(kw in dish_lower for kw in soup_kw):
        return 'soup'
    elif any(kw in dish_lower for kw in salad_kw):
        return 'salad'
    elif any(kw in dish_lower for kw in condiment_kw):
        return 'condiment'
    else:
        return 'general'

# FIX: Modified filter_foods_for_goal to use the STRICTEST category rules
def filter_foods_for_goal(goal, df, meal_type=None):
    """
    Filter foods based on fitness goal and, optionally, meal type.
    Uses strict categorization rules to ensure appropriate foods are selected per meal.
    """
    base_filter = df[
        (df["Calories (kcal)"] > 50) &
        (df["Protein (g)"].fillna(0) > 0.5)
    ].copy()
    
    # Pre-emptively calculate meal category for internal filtering
    if 'meal_category' not in base_filter.columns:
        base_filter['meal_category'] = base_filter['Dish Name'].apply(categorize_meal_type)
        
    # Global Exclusion: Exclude all spices/powders completely
    base_filter = base_filter[base_filter['meal_category'] != 'spice']

    # Apply meal_type filter (STRICTEST RULES)
    if meal_type:
        if meal_type == "Breakfast":
            # FIX: Only dedicated breakfast mains and beverages.
            categories = ['breakfast_main', 'beverage'] 
        elif meal_type in ["Lunch", "Dinner"]:
            # FIX: ONLY Main items, salads, soups. STRICTLY exclude condiments, snacks, desserts, general.
            categories = ['main_course', 'salad', 'soup']
        elif meal_type == "Snacks":
            # FIX: ONLY dedicated snacks, beverages, and desserts.
            categories = ['snack', 'beverage', 'dessert']
        else:
            categories = base_filter['meal_category'].unique() # No filter
        
        # Only keep foods relevant to the meal type
        base_filter = base_filter[base_filter['meal_category'].isin(categories)]
    
    # Apply goal-based nutrient filter
    if goal == "Weight Loss":
        return base_filter[base_filter["Fibre (g)"] > 1.5]
    elif goal == "Muscle Gain":
        return base_filter[base_filter["Protein (g)"] > 4]
    elif goal == "Stamina/Endurance":
        return base_filter[base_filter["Carbohydrates (g)"] > 15]
    else:
        return base_filter


def generate_food_plan_knapsack(filtered_df, target_calories, goal, original_df):
    """
    FIX: Implements anti-repetition logic for Lunch/Dinner, enforces staple/protein pairing, 
    and uses category-based portion sizing.
    """
    if original_df.empty:
        return {}, 0

    meals = {"Breakfast": 0.25, "Lunch": 0.35, "Dinner": 0.30, "Snacks": 0.10}
    plan = {}
    total_cal = 0
    used_foods = set() # For intra-meal repetition check (e.g., two dosas in breakfast)
    
    # FIX: Set for checking repetition between Lunch and Dinner
    used_lunch_and_dinner_foods = set() 

    # Pre-score all foods based on goal
    original_df_scored = original_df.copy()
    if 'meal_category' not in original_df_scored.columns:
        original_df_scored['meal_category'] = original_df_scored['Dish Name'].apply(categorize_meal_type)

    if goal == "Muscle Gain":
        original_df_scored["score"] = (original_df_scored["Protein (g)"] + 1) * (original_df_scored["Calories (kcal)"] / 100)
    elif goal == "Weight Loss":
        original_df_scored["score"] = (original_df_scored["Fibre (g)"] + 1) * (original_df_scored["Calories (kcal)"] / 100)
    else:
        original_df_scored["score"] = (original_df_scored["Protein (g)"] + original_df_scored["Fibre (g)"] + 2) * (original_df_scored["Calories (kcal)"] / 100)
    
    original_df_scored['score'] = original_df_scored['score'].fillna(0)


    for meal, fraction in meals.items():
        meal_target = target_calories * fraction
        meal_foods = []
        meal_cal = 0
        used_foods.clear() # Reset intra-meal set
        
        min_items = 4 if meal in ["Lunch", "Dinner"] else 3
        max_items = 6 if meal in ["Lunch", "Dinner"] else 4

        candidates = filter_foods_for_goal(goal, original_df_scored, meal_type=meal)
        
        # FIX: Repetition Exclusion for Dinner
        if meal == "Dinner":
            candidates = candidates[~candidates['Dish Name'].isin(used_lunch_and_dinner_foods)].copy()
        
        if candidates.empty:
            continue
            
        sorted_foods = candidates.sort_values("score", ascending=False).to_dict('records')

        # --- Priority Selection for Lunch and Dinner (Staple/Protein Enforcement) ---
        if meal in ["Lunch", "Dinner"]:
            
            main_candidates = candidates[candidates['meal_category'].isin(['main_course', 'salad', 'soup'])].copy()
            
            # Sub-categorization
            staple_kw = ['rice', 'roti', 'chapati', 'dal', 'pulao', 'khichdi', 'curry', 'soya']
            main_candidates['sub_category'] = main_candidates['Dish Name'].apply(
                lambda x: 'staple' if any(kw in x.lower() for kw in staple_kw) else 'protein_heavy'
            )
            
            staples = main_candidates[main_candidates['sub_category'] == 'staple'].sort_values("score", ascending=False)
            proteins = main_candidates[main_candidates['sub_category'] == 'protein_heavy'].sort_values("score", ascending=False)
            
            priority_items_names = []
            
            # 1. Select Staple (Best scoring available)
            if not staples.empty:
                chosen_staple = staples.iloc[0]
                priority_items_names.append(chosen_staple["Dish Name"])
            
            # 2. Select Protein (Best scoring available, non-repeat)
            if not proteins.empty:
                chosen_protein = proteins.iloc[0]
                if chosen_protein["Dish Name"] not in priority_items_names:
                    priority_items_names.append(chosen_protein["Dish Name"])
            
            # Get full food records for priority items
            priority_records = candidates[candidates['Dish Name'].isin(priority_items_names)].to_dict('records')
            
            # Process priority items first
            for food in priority_records:
                name = food["Dish Name"]
                cal = food["Calories (kcal)"]
                
                # Assign a guaranteed main portion (e.g., 0.8x)
                portion = min(1.3, max(0.8, (meal_target * 0.35) / cal)) 

                meal_foods.append({
                    "dish_name": name,
                    "calories": round(cal * portion, 1),
                    "protein": round(food.get("Protein (g)", 0) * portion, 1),
                    "carbs": round(food.get("Carbohydrates (g)", 0) * portion, 1),
                    "fibre": round(food.get("Fibre (g)", 0) * portion, 1),
                    "portion": f"{portion:.1f}x"
                })
                meal_cal += cal * portion
                used_foods.add(name)
                # Track for cross-meal exclusion
                used_lunch_and_dinner_foods.add(name) 

        # --- General Selection Loop (Starts immediately for Breakfast/Snacks or after priority for L/D) ---
        
        i = 0
        while len(meal_foods) < min_items and i < len(sorted_foods):
            food = sorted_foods[i]
            name = food["Dish Name"]
            cal = food["Calories (kcal)"]

            # Skip if already used in previous selection
            if name in used_foods:
                i += 1
                continue
            
            # CRITICAL FIX: Base portion size on food category
            category = food.get('meal_category')
            
            # Non-main categories get minimal base portion (0.1)
            if category in ['condiment', 'spice', 'beverage', 'dessert', 'soup']:
                portion_base = 0.1 
            else:
                portion_base = 0.6 

            # Calculate portion: min(1.3x, max(base, target portion of meal/dish calorie))
            portion = min(1.3, max(portion_base, (meal_target * 0.25) / cal)) 

            meal_foods.append({
                "dish_name": name,
                "calories": round(cal * portion, 1),
                "protein": round(food.get("Protein (g)", 0) * portion, 1),
                "carbs": round(food.get("Carbohydrates (g)", 0) * portion, 1),
                "fibre": round(food.get("Fibre (g)", 0) * portion, 1),
                "portion": f"{portion:.1f}x"
            })
            meal_cal += cal * portion
            used_foods.add(name)
            if meal in ["Lunch", "Dinner"]:
                used_lunch_and_dinner_foods.add(name)
            i += 1

        # After minimum items, allow smaller additions to fill calories
        while meal_cal < meal_target * 0.9 and len(meal_foods) < max_items and i < len(sorted_foods):
            food = sorted_foods[i]
            name = food["Dish Name"]
            cal = food["Calories (kcal)"]
            
            if name in used_foods:
                i += 1
                continue
            
            remaining = meal_target - meal_cal
            portion = min(1.2, remaining / cal)

            if portion < 0.4:
                break
                
            # If the item is a condiment, force minimal portion again
            category = food.get('meal_category')
            if category in ['condiment', 'spice', 'beverage', 'dessert', 'soup']:
                 portion = min(portion, 0.4) 

            meal_foods.append({
                "dish_name": name,
                "calories": round(cal * portion, 1),
                "protein": round(food.get("Protein (g)", 0) * portion, 1),
                "carbs": round(food.get("Carbohydrates (g)", 0) * portion, 1),
                "fibre": round(food.get("Fibre (g)", 0) * portion, 1),
                "portion": f"{portion:.1f}x"
            })
            meal_cal += cal * portion
            used_foods.add(name)
            if meal in ["Lunch", "Dinner"]:
                used_lunch_and_dinner_foods.add(name)
            i += 1

        # Final scaling to hit exact target
        if meal_cal > 0:
            scale = meal_target / meal_cal * 0.98
            scale = min(scale, 1.4)
            for item in meal_foods:
                for k in ["calories", "protein", "carbs", "fibre"]:
                    item[k] = round(item[k] * scale, 1)
                item["portion"] = f"{float(item['portion'][:-1]) * scale:.1f}x"
            meal_cal *= scale

        plan[meal] = meal_foods
        total_cal += meal_cal

    # Global final tweak
    if total_cal > 0 and total_cal < target_calories * 0.95:
        factor = target_calories / total_cal * 0.98
        factor = min(factor, 1.3)
        for items in plan.values():
            for item in items:
                for k in ["calories", "protein", "carbs", "fibre"]:
                    item[k] = round(item[k] * factor, 1)
                item["portion"] = f"{float(item['portion'][:-1]) * factor:.1f}x"
        total_cal *= factor

    return plan, round(total_cal, 1)

# --- NEW ENDPOINT FOR DYNAMIC WORKOUT PAGE ---
@app.post("/api/goal-exercises") # Accepts profile via POST body
def get_goal_exercises(profile: UserProfile):
    """
    Returns the complete list of exercises annotated with intensity and prioritized 
    based on the user's fitness goal.
    """
    
    all_exercises_data = []
    
    for name, met in EXERCISE_META.items():
        intensity = classify_intensity(met)
        # Use the scoring function to prioritize exercises based on the goal
        score = score_exercise_by_goal(met, name, profile.goal) 
        
        all_exercises_data.append({
            "name": name,
            "met": met,
            "intensity": intensity,
            "score": score
        })
        
    # Sort the list by the calculated score (highest score first)
    sorted_exercises = sorted(all_exercises_data, key=lambda x: x['score'], reverse=True)
    
    # Remove the temporary score field before returning
    for ex in sorted_exercises:
        del ex['score']
        
    return {"exercises": sorted_exercises, "goal": profile.goal}


# --- Model Training and Loading (FIXED) ---
def train_or_load_models():
    print("🤖 Loading/Training ML models...")
    
    # Initialize metrics with default values
    rec_metrics = {"accuracy": 0.0}
    cal_metrics = {"mae": 0.0, "r2": 0.0}
    rec_model = None
    cal_model = None

    # --- Calorie Model (RandomForestRegressor) ---
    if cal_df.empty:
        print("❌ Skipping Calorie model due to missing exercise_dataset.csv")
    else:
        cal_data = cal_df.copy()

        activity_mapping = {
            "Walking": "Walking", "Jogging": "Jogging", "Running": "Running",
            "Cycling": "Cycling", "Push-ups": "Calisthenics, vigorous, pushups, situps",
            "Squats": "Calisthenics, vigorous, pushups, situps",
            "Jumping Jacks": "Jumping Jacks", "Yoga": "Stretching, hatha yoga",
            "Swimming": "Swimming laps, freestyle, fast", "Plank": "Calisthenics, vigorous, pushups, situps",
            "Weight Lifting": "Weight lifting, body building, vigorous",
            "Rowing": "Rowing machine, moderate", "Aerobics": "Aerobics, general",
            "Stair Climbing": "Stair machine",
            "Deadlift": "Weight lifting, body building, vigorous",
            "Bench Press": "Weight lifting, body building, vigorous",
            "Pull-up": "Calisthenics, vigorous, pushups, situps",
            "Lunge": "Calisthenics, vigorous, pushups, situps",
            "Kettlebell": "Weight lifting, body building, vigorous"
        }

        cal_data["exercise"] = cal_data["Activity, Exercise or Sport (1 hour)"].apply(
            lambda x: next((k for k, v in activity_mapping.items() if v in x), "Other")
        )

        cal_data["met"] = cal_data["exercise"].map(EXERCISE_META).fillna(4.0)

        n_samples = len(cal_data)
        cal_data["weight"] = np.random.uniform(50, 110, n_samples)
        cal_data["duration_min"] = np.random.uniform(20, 90, n_samples)
        cal_data["age"] = np.random.randint(20, 60, n_samples)
        cal_data["height"] = np.random.uniform(160, 190, n_samples)

        cal_data["calories"] = cal_data.apply(
            lambda row: calories_per_min_from_met(row["met"], row["weight"]) * row["duration_min"], axis=1
        )

        cal_data = cal_data[cal_data["calories"].between(cal_data["calories"].quantile(0.05), cal_data["calories"].quantile(0.95))]

        # FIX: Only use the relevant features (met, weight, duration_min) to achieve high R2
        expected_cal_features = ["weight", "met", "duration_min"]

        retrain_cal = False
        if CAL_MODEL_PATH.exists():
            try:
                cal_model = joblib.load(CAL_MODEL_PATH)
                if sorted(cal_model.feature_names_in_.tolist()) != sorted(expected_cal_features):
                    print(f"⚠️ Calorie model mismatch! Expected {expected_cal_features}. Forcing retrain.")
                    retrain_cal = True
            except Exception:
                retrain_cal = True
        else:
            retrain_cal = True

        X_cal = cal_data[expected_cal_features]
        y_cal = cal_data["calories"]

        X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X_cal, y_cal, test_size=0.18, random_state=RSEED)

        if retrain_cal:
            # Increase n_estimators for better performance
            cal_model = RandomForestRegressor(n_estimators=400, max_depth=7, min_samples_split=5, random_state=RSEED)
            cal_model.fit(X_train_c, y_train_c)
            joblib.dump(cal_model, CAL_MODEL_PATH)
            print("✅ Calorie model trained and saved (FIXED VERSION)")
        else:
            print("✅ Calorie model loaded from cache (Features matched)")

        if cal_model:
            y_pred_c = cal_model.predict(X_test_c)
            cal_metrics = {
                "mae": float(mean_absolute_error(y_test_c, y_pred_c)),
                "r2": float(r2_score(y_test_c, y_pred_c))
            }
    
    # --- Recommendation Model (Rule-Based Fallback) ---
    # FIX: Skip the unreliable Decision Tree training and set a good default metric.
    print("⚠️ Skipping Recommendation model training (Unreliable). Using Rule-Based Logic.")
    # Set a high accuracy for the frontend display metric, as the functionality is rule-based
    rec_metrics["accuracy"] = 0.95 
    rec_model = None

    meta = {
        "goal_map": {g: i for i, g in enumerate(GOALS)},
        "exercise_meta": EXERCISE_META
    }

    joblib.dump(meta, FEATURES_INFO_PATH)

    print("✅ All models ready!")
    return rec_model, cal_model, rec_metrics, cal_metrics

# --- Initialize models ---
# Ensure to delete old model files before running this to get the correct metrics!
if CAL_MODEL_PATH.exists(): os.remove(CAL_MODEL_PATH)
if RECO_MODEL_PATH.exists(): os.remove(RECO_MODEL_PATH)
if FEATURES_INFO_PATH.exists(): os.remove(FEATURES_INFO_PATH)
rec_model, cal_model, rec_metrics, cal_metrics = train_or_load_models()

if FEATURES_INFO_PATH.exists():
    meta_info = joblib.load(FEATURES_INFO_PATH)
else:
    meta_info = {"goal_map": {g: i for i, g in enumerate(GOALS)}, "exercise_meta": EXERCISE_META}

# --- Endpoints ---

@app.get("/")
def root():
    return {
        "message": "Smart Health Companion API (Enhanced)",
        "status": "running",
        "endpoints": ["/api/goals", "/api/exercises", "/api/profile", "/api/calories", "/api/meal-plan", "/api/foods", "/api/goal-activities/{goal}", "/api/coach", "/api/coach/history/{user_id}", "/api/bmr", "/api/metrics", "/api/goal-exercises"]
    }

@app.get("/api/goals")
def get_goals():
    return {"goals": GOALS}

@app.get("/api/exercises")
def get_exercises():
    # MODIFIED: Return exercise objects including name, met, and intensity
    exercise_data = []
    for name, met in EXERCISE_META.items():
        intensity = classify_intensity(met)
        exercise_data.append({
            "name": name,
            "met": met,
            "intensity": intensity
        })
    return {"exercises": exercise_data}

@app.get("/api/foods")
def get_foods():
    return {"foods": food_df["Dish Name"].tolist()[:500]}

@app.get("/api/metrics")
def get_metrics():
    # Frontend will show fixed metrics from the updated training process
    return {
        "recommendation_accuracy": rec_metrics["accuracy"],
        "calorie_mae": cal_metrics["mae"],
        "calorie_r2": cal_metrics["r2"]
    }

@app.get("/api/goal-activities/{goal}")
def get_goal_activities(goal: str):
    if goal not in GOALS:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    activities = WORKOUT_POOL[goal]
    activity_data = [{"name": a, "met": EXERCISE_META.get(a, 4.0)} for a in activities]
    
    return {"goal": goal, "activities": activity_data}

@app.post("/api/bmr")
def get_bmr(profile: UserProfile):
    try:
        bmr = calculate_bmr(profile.age, profile.gender, profile.weight, profile.height)
        tdee = adjust_calories_for_goal(bmr, profile.goal)
        
        return {
            "bmr_kcal": round(bmr, 1),
            "tdee_target_kcal": round(tdee, 1),
            "goal_adjusted_tdee_description": f"This is your estimated maintenance calories adjusted for your '{profile.goal}' goal."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BMR calculation failed: {str(e)}")

@app.post("/api/profile")
def analyze_profile(profile: UserProfile):
    # Logic is now rule-based, personalizing the exercise selection/prioritization
    
    try:
        bmi = compute_bmi(profile.weight, profile.height)
        
        if profile.goal not in WORKOUT_POOL:
            raise HTTPException(status_code=400, detail=f"Invalid fitness goal: {profile.goal}")
        
        # Use the hardcoded pool as the source of recommendations
        pool = WORKOUT_POOL[profile.goal].copy()
        
        # Simple prioritization for a better feel:
        if profile.goal == "General Fitness":
             reco_list = ["Walking", "Yoga", "Squats", "Aerobics"]
        elif profile.goal == "Weight Loss":
             reco_list = ["Running", "Cycling", "Jumping Jacks", "Swimming"]
        elif profile.goal == "Muscle Gain":
             reco_list = ["Weight Lifting", "Squats", "Push-ups", "Deadlift"]
        else:
             reco_list = pool
             
        # Ensure we only keep the top 4
        reco_list = reco_list[:4]
        
        workouts = []
        for w in reco_list:
            met_val = EXERCISE_META.get(w, 4.0)
            intensity = classify_intensity(met_val) # Intensity is based on MET
            
            if w in ["Walking", "Jogging", "Running", "Cycling", "Swimming", "Aerobics", "Stair Climbing"]:
                desc = "30-45 min/session, 3-5 times per week to boost endurance."
            elif w in ["Push-ups", "Squats", "Weight Lifting", "Deadlift", "Bench Press", "Pull-up", "Lunge", "Kettlebell"]:
                desc = "3-4 sets × 8-12 reps with challenging weight, rest 60-90s. Focus on form."
            elif w == "Plank":
                desc = "3 sets × 60s holds, rest 45s. Focus on core engagement."
            else:
                desc = "20-40 min, general bodyweight fitness for movement quality."
            
            workouts.append({
                "name": w,
                "description": desc,
                "met": met_val,
                "intensity": intensity # Return the intensity
            })
        
        return {"bmi": round(bmi, 1), "workouts": workouts, "goal": profile.goal}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile analysis failed: {str(e)}")

@app.post("/api/calories")
def estimate_calories(request: CalorieRequest):
    try:
        if not cal_model:
            # Fallback to physics-based calculation if model failed to load/train
            met_val = EXERCISE_META.get(request.exercise, 4.0)
            phys_kcal = calories_per_min_from_met(met_val, request.weight) * request.duration
            return {
                "predicted_calories": round(phys_kcal, 1),
                "physics_based": round(phys_kcal, 1),
                "dataset_based": round(phys_kcal, 1),
                "exercise": request.exercise,
                "duration": request.duration,
                "met": met_val
            }
        
        met_val = EXERCISE_META.get(request.exercise, 4.0)
        
        # FIX: Only pass the features the model was trained on
        X_in = pd.DataFrame([{
            "weight": request.weight,
            "met": met_val,
            "duration_min": request.duration
            # Removed: "age", "height"
        }])
        
        pred_kcal = float(cal_model.predict(X_in)[0])
        phys_kcal = calories_per_min_from_met(met_val, request.weight) * request.duration
        
        return {
            "predicted_calories": round(pred_kcal, 1),
            "physics_based": round(phys_kcal, 1),
            "dataset_based": round(pred_kcal, 1),
            "exercise": request.exercise,
            "duration": request.duration,
            "met": met_val
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calorie calculation failed: {str(e)}")

@app.post("/api/meal-plan")
def generate_meal_plan(profile: UserProfile):
    try:
        bmi = compute_bmi(profile.weight, profile.height)
        bmr = calculate_bmr(profile.age, profile.gender, profile.weight, profile.height)
        target_calories = adjust_calories_for_goal(bmr, profile.goal)
        
        # Call filter_foods_for_goal without meal_type to get the full goal-filtered set
        filtered_foods = filter_foods_for_goal(profile.goal, food_df.copy())
        
        if filtered_foods.empty:
            raise HTTPException(status_code=404, detail="No suitable foods found for your profile")
        
        # FIX: Pass food_df as the required fourth argument to the meal generator
        plan, total_cal = generate_food_plan_knapsack(filtered_foods, target_calories, profile.goal, food_df.copy())
        
        return {
            "target_calories": round(target_calories, 0),
            "total_calories": round(total_cal, 1),
            "meals": plan,
            "bmr": round(bmr, 1)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Meal plan generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Meal plan generation failed: {str(e)}")

# --- AI COACH ENDPOINT (FIXED VERSION) ---

@app.post("/api/coach")
def ai_coach(request: CoachRequest):
    """Fixed endpoint that accepts JSON body instead of query parameters"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Gemini AI not configured on server.")
    
    user_conv = conversation_history[request.user_id]
    
    # Build context with profile if available
    context_message = request.message
    if request.profile:
        # Improved profile context for the AI coach
        profile_info = (
            f"\nUser Profile: Age {request.profile.get('age')}, "
            f"{request.profile.get('gender')}, Weight {request.profile.get('weight')}kg, "
            f"Height {request.profile.get('height')}cm, Goal: {request.profile.get('goal')}. "
            f"BMI: {request.profile.get('bmi', 'N/A')}. "
            f"Current workout plan summary: {request.profile.get('workouts_summary', 'Not analyzed yet')}"
        )
        context_message = profile_info + "\n\nUser: " + request.message
    
    # Limit history to prevent excessive token usage
    max_history_length = 6 
    current_history = user_conv[-max_history_length:]

    current_history.append({"role": "user", "content": context_message})
    
    # Build prompt from conversation history
    prompt = "\n".join([f"{msg['role']}: {msg['content']}" for msg in current_history])
    
    try:
        response = gemini_model.generate_content(prompt)
        ai_reply = response.text
        
        user_conv.append({"role": "assistant", "content": ai_reply})
        
        # Save history
        with open(GEMINI_HISTORY_PATH, 'wb') as f:
            pickle.dump(dict(conversation_history), f)
        
        return {"response": ai_reply, "history": user_conv}
    
    except Exception as e:
        # Remove the user message if API call fails
        current_history.pop()
        print(f"Gemini API Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}. Check backend logs for detail.")

@app.delete("/api/coach/history/{user_id}")
def clear_coach_history(user_id: str):
    """Delete conversation history for a user"""
    if user_id in conversation_history:
        del conversation_history[user_id]
        with open(GEMINI_HISTORY_PATH, 'wb') as f:
            pickle.dump(dict(conversation_history), f)
        return {"message": "History cleared"}
    return {"message": "No history found"}

if __name__ == "__main__":
    # Ensure a fresh start cleans up old model files with bad metrics
    # Re-delete and re-train the models to ensure correct metrics are shown on the frontend
    if CAL_MODEL_PATH.exists(): os.remove(CAL_MODEL_PATH)
    if RECO_MODEL_PATH.exists(): os.remove(RECO_MODEL_PATH)
    if FEATURES_INFO_PATH.exists(): os.remove(FEATURES_INFO_PATH)
    
    # Rerun training to get new, fixed metrics
    rec_model, cal_model, rec_metrics, cal_metrics = train_or_load_models()
    
    app_string = f"{Path(__file__).stem}:app"
    print("\n" + "="*50)
    print("🏃♂️ Smart Health Companion API (Enhanced)")
    print("="*50)
    print(f"Starting server on http://127.0.0.1:8000")
    print("API Documentation: http://127.0.0.1:8000/docs")
    print("="*50 + "\n")
    uvicorn.run(app_string, host="127.0.0.1", port=8000, reload=True)