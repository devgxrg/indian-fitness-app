# Smart Health Companion - Setup Guide for macOS

## 📁 Project Structure

```
/Volumes/WD_2TB/Projects/college fitness/
├── backend/
│   ├── main.py                          # FastAPI backend
│   ├── requirements.txt                 # Python dependencies
│   ├── exercise_dataset.csv            # Your existing data
│   ├── fitness_and_workout_dataset.csv # Your existing data
│   ├── Indian_Food_Nutrition_Processed.csv # Your existing data
│   └── models/                          # Auto-generated ML models
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── App.jsx
        └── main.jsx
```

---

## 🚀 Step-by-Step Setup

### Step 1: Create Backend Directory

Open Terminal and run:

```bash
cd "/Volumes/WD_2TB/Projects/college fitness"
mkdir backend
cd backend
```

### Step 2: Move Your CSV Files

```bash
# Move your existing CSV files to backend folder
mv ../exercise_dataset.csv .
mv ../fitness_and_workout_dataset.csv .
mv ../Indian_Food_Nutrition_Processed.csv .
```

### Step 3: Create Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate
```

### Step 4: Install Python Dependencies

Create `requirements.txt`:

```bash
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
pandas==2.1.3
numpy==1.26.2
scikit-learn==1.3.2
joblib==1.3.2
pydantic==2.5.0
python-multipart==0.0.6
EOF
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Step 5: Create FastAPI Backend

Copy the `main.py` file I provided earlier into the `backend` folder.

### Step 6: Test Backend

```bash
# Start the backend server
python main.py
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Test in browser: http://localhost:8000 (should show JSON response)

---

### Step 7: Create Frontend

Open a **NEW Terminal window** (keep backend running) and run:

```bash
cd "/Volumes/WD_2TB/Projects/college fitness"

# Create React app with Vite
npm create vite@latest frontend -- --template react
cd frontend

# Install dependencies
npm install
npm install axios lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 8: Configure Tailwind CSS

Edit `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Step 9: Update CSS

Replace contents of `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Step 10: Update Main Entry Point

Replace `src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### Step 11: Replace App Component

Replace `src/App.jsx` with the React component I provided earlier.

### Step 12: Update Vite Config (for API proxy)

Edit `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

### Step 13: Start Frontend

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 🎯 Usage

1. **Backend Terminal**: Keep running `python main.py` in backend folder
2. **Frontend**: Open http://localhost:5173 in your browser
3. **Features**:
   - Fill profile form and click "Analyze Profile"
   - Switch tabs to explore different features
   - Generate meal plans
   - Calculate calories burned

---

## 🛠️ Troubleshooting

### Issue: "Module not found" errors in Python

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: CORS errors in browser console

Make sure both servers are running:
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

### Issue: CSV files not found

```bash
cd backend
ls -la *.csv  # Should show all 3 CSV files
```

### Issue: Port already in use

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

---

## 📦 Complete Package.json

Your `frontend/package.json` should look like:

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "lucide-react": "^0.294.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "vite": "^5.0.8"
  }
}
```

---

## 🎨 Features Included

✅ Modern gradient UI with Tailwind CSS  
✅ Responsive design (works on all screen sizes)  
✅ Real-time API communication  
✅ Profile analysis with BMI calculation  
✅ AI-powered workout recommendations  
✅ Calorie burn calculator with 3 methods  
✅ Personalized meal plan generator  
✅ Beautiful data visualization  
✅ Loading states and error handling  

---

## 🚀 Production Build

When ready to deploy:

```bash
# Frontend
cd frontend
npm run build
# Creates optimized build in dist/

# Backend can be deployed to services like:
# - Railway.app
# - Render.com
# - Heroku
# - DigitalOcean
```

---

## 📞 Quick Start Commands

**Terminal 1 (Backend):**
```bash
cd "/Volumes/WD_2TB/Projects/college fitness/backend"
source venv/bin/activate
python main.py
```

**Terminal 2 (Frontend):**
```bash
cd "/Volumes/WD_2TB/Projects/college fitness/frontend"
npm run dev
```

**Open in browser:** http://localhost:5173

---

Enjoy your modern AI fitness companion! 🏃‍♂️💪