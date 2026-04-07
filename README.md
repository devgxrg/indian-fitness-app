# Indian Fitness App

An AI-powered fitness companion tailored for Indian users — workout recommendations, calorie tracking, and personalized meal plans using Indian food data.

## Features

- Profile analysis with BMI calculation
- ML-based workout recommendations
- Calorie burn calculator
- Indian food meal plan generator
- Gemini AI chat integration

## Tech Stack

**Backend:** FastAPI, scikit-learn, pandas, Gemini API  
**Frontend:** React, Vite, Tailwind CSS

## Project Structure

```
├── backend/
│   ├── main.py                              # FastAPI server
│   ├── requirements.txt
│   ├── exercise_dataset.csv
│   ├── fitness_and_workout_dataset.csv
│   ├── Indian_Food_Nutrition_Processed.csv
│   └── models/                              # Auto-generated on first run
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:
```
GEMINI_API_KEY=your_api_key_here
```

Start the server:
```bash
uvicorn main:app --reload
```

Backend runs at http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

## Usage

1. Start the backend (Terminal 1)
2. Start the frontend (Terminal 2)
3. Open http://localhost:5173
4. Fill in your profile and explore the features
