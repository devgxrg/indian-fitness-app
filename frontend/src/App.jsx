import { useState, useEffect } from 'react';
import { Activity, Target, Utensils, Dumbbell, Apple, Flame, Zap, Heart, Moon, Sun, MessageCircle, Send, Trash2 } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState({
    age: 25,
    gender: 'Male',
    weight: 70,
    height: 175,
    goal: 'General Fitness'
  });

  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState(null);
  const [calorieData, setCalorieData] = useState(null);
  const [mealPlan, setMealPlan] = useState(null);
  const [goals, setGoals] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [calorieForm, setCalorieForm] = useState({
    exercise: 'Walking',
    duration: 30
  });

  const [coachMessages, setCoachMessages] = useState([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [userId] = useState(() => 'user_' + Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [goalsRes, exercisesRes, metricsRes] = await Promise.all([
        axios.get(`${API_URL}/api/goals`),
        axios.get(`${API_URL}/api/exercises`),
        axios.get(`${API_URL}/api/metrics`)
      ]);
      setGoals(goalsRes.data.goals);
      
      // MODIFIED: exercisesRes.data.exercises is now an array of objects
      setExercises(exercisesRes.data.exercises); 
      
      setMetrics(metricsRes.data);
      setError(null);
      
      // Set default exercise for calorie form from the new object list
      if (exercisesRes.data.exercises.length > 0) {
        setCalorieForm(prev => ({ ...prev, exercise: exercisesRes.data.exercises[0].name }));
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to connect to backend. Make sure the server is running on http://127.0.0.1:8000');
    }
  };

  const analyzeProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/profile`, profile);
      setProfileData(response.data);
    } catch (error) {
      console.error('Error analyzing profile:', error);
      setError('Failed to analyze profile. Please try again.');
    }
    setLoading(false);
  };

  const estimateCalories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/calories`, {
        ...profile,
        ...calorieForm
      });
      setCalorieData(response.data);
    } catch (error) {
      console.error('Error estimating calories:', error);
      setError('Failed to estimate calories. Please try again.');
    }
    setLoading(false);
  };

  const generateMealPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/meal-plan`, profile);
      setMealPlan(response.data);
    } catch (error) {
      console.error('Error generating meal plan:', error);
      setError('Failed to generate meal plan. Please try again.');
    }
    setLoading(false);
  };

  const sendCoachMessage = async () => {
    if (!coachInput.trim()) return;
    
    setCoachLoading(true);
    const userMessage = coachInput;
    setCoachInput('');
    
    // Add user message to chat
    setCoachMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      // Prepare comprehensive profile data
      const coachProfile = {
        age: profile.age,
        gender: profile.gender,
        weight: profile.weight,
        height: profile.height,
        goal: profile.goal,
        bmi: profileData?.bmi || null,
        workouts_summary: profileData?.workouts?.map(w => 
          `${w.name} (${w.intensity || 'Moderate'} intensity, MET: ${w.met})`
        ).join(', ') || 'Not analyzed yet'
      };
      
      const response = await axios.post(`${API_URL}/api/coach`, {
        message: userMessage,
        user_id: userId,
        profile: coachProfile
      });
      
      // Add coach response
      setCoachMessages(prev => [...prev, { role: 'coach', content: response.data.response }]);
    } catch (error) {
      console.error('Error sending message to coach:', error);
      let errorMsg = 'Sorry, I encountered an error. ';
      if (error.response?.status === 503) {
        errorMsg += 'AI Coach is not configured. Please set GEMINI_API_KEY in your backend.';
      } else {
        errorMsg += 'Please try again or check your connection.';
      }
      setCoachMessages(prev => [...prev, { role: 'coach', content: errorMsg }]);
    }
    setCoachLoading(false);
  };

  const clearCoachHistory = async () => {
    try {
      await axios.delete(`${API_URL}/api/coach/history/${userId}`);
      setCoachMessages([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  // Format coach message with better styling
  const formatCoachMessage = (text) => {
    // Split by lines
    const lines = text.split('\n');
    const formatted = [];
    
    lines.forEach((line, idx) => {
      // Headers (lines starting with ##, ###, or bold **)
      if (line.match(/^#{1,3}\s/)) {
        const headerText = line.replace(/^#{1,3}\s/, '');
        formatted.push(
          <h3 key={idx} className="text-lg font-bold mt-3 mb-2 text-blue-300">
            {headerText}
          </h3>
        );
      }
      // Bold text
      else if (line.match(/\*\*(.*?)\*\*/g)) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        formatted.push(
          <p key={idx} className="mb-2">
            {parts.map((part, i) => 
              part.match(/\*\*(.*?)\*\*/) 
                ? <strong key={i} className="font-bold text-cyan-300">{part.replace(/\*\*/g, '')}</strong>
                : part
            )}
          </p>
        );
      }
      // Bullet points
      else if (line.match(/^[•\-\*]\s/)) {
        const text = line.replace(/^[•\-\*]\s/, '');
        formatted.push(
          <li key={idx} className="ml-4 mb-1 list-disc">
            {text}
          </li>
        );
      }
      // Numbered lists
      else if (line.match(/^\d+\.\s/)) {
        const text = line.replace(/^\d+\.\s/, '');
        formatted.push(
          <li key={idx} className="ml-4 mb-1 list-decimal">
            {text}
          </li>
        );
      }
      // Regular text
      else if (line.trim()) {
        formatted.push(
          <p key={idx} className="mb-2">
            {line}
          </p>
        );
      }
    });
    
    return formatted;
  };
  
  // Helper function to render intensity badge
  const renderIntensityBadge = (intensity) => {
    let bgColor, textColor, borderColor;
    if (intensity === 'Vigorous') {
        bgColor = 'bg-red-500/20';
        textColor = 'text-red-400';
        borderColor = 'border-red-500/30';
    } else if (intensity === 'Moderate') {
        bgColor = 'bg-orange-500/20';
        textColor = 'text-orange-400';
        borderColor = 'border-orange-500/30';
    } else { // Light
        bgColor = 'bg-green-500/20';
        textColor = 'text-green-400';
        borderColor = 'border-green-500/30';
    }
    
    return (
        <span className={`text-xs px-3 py-1 rounded-full border transition-colors duration-500 font-semibold ${bgColor} ${textColor} ${borderColor}`}>
            {intensity}
        </span>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Activity },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'calories', label: 'Calories', icon: Flame },
    { id: 'nutrition', label: 'Nutrition', icon: Apple },
    { id: 'coach', label: 'AI Coach', icon: MessageCircle }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      darkMode 
        ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-20 left-20 w-96 h-96 ${darkMode ? 'bg-blue-500/10' : 'bg-blue-400/20'} rounded-full blur-3xl animate-pulse`}></div>
        <div className={`absolute bottom-20 right-20 w-96 h-96 ${darkMode ? 'bg-cyan-500/10' : 'bg-purple-400/20'} rounded-full blur-3xl animate-pulse`} style={{animationDelay: '1s'}}></div>
      </div>

      {/* Header */}
      <header className={`relative z-10 backdrop-blur-xl border-b transition-colors duration-500 ${
        darkMode 
          ? 'bg-slate-800/50 border-blue-500/20' 
          : 'bg-white/70 border-blue-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-2xl shadow-lg shadow-blue-500/50">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold bg-gradient-to-r ${darkMode ? 'from-blue-400 to-cyan-400' : 'from-blue-600 to-cyan-600'} bg-clip-text text-transparent transition-all duration-500`}>
                  Smart Health Companion
                </h1>
                <p className={`text-sm mt-1 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>AI-Powered Fitness Assistant</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Dark/Light Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-3 rounded-xl border transition-all duration-300 hover:scale-110 ${
                  darkMode 
                    ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-yellow-400' 
                    : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700 shadow-lg'
                }`}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
              </button>
              
              {metrics && (
                <div className="hidden md:flex space-x-4">
                  <div className={`backdrop-blur-sm border px-4 py-2 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`text-xs font-medium transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Model Accuracy</p>
                    <p className={`text-lg font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{(metrics.recommendation_accuracy * 100).toFixed(0)}%</p>
                  </div>
                  <div className={`backdrop-blur-sm border px-4 py-2 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'}`}>
                    <p className={`text-xs font-medium transition-colors duration-500 ${darkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>Calorie R²</p>
                    <p className={`text-lg font-bold transition-colors duration-500 ${darkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>{metrics.calorie_r2.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className={`backdrop-blur-sm border rounded-xl p-4 transition-colors duration-500 ${darkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className={`backdrop-blur-xl rounded-2xl p-2 inline-flex space-x-2 border transition-colors duration-500 ${
          darkMode 
            ? 'bg-slate-800/50 border-blue-500/20' 
            : 'bg-white/70 border-blue-200'
        }`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                    : darkMode
                      ? 'text-blue-300 hover:bg-blue-500/10'
                      : 'text-blue-700 hover:bg-blue-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Form */}
            <div className="lg:col-span-1">
              <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
                darkMode 
                  ? 'bg-slate-800/50 border-blue-500/20' 
                  : 'bg-white/80 border-blue-200'
              }`}>
                <h2 className={`text-2xl font-bold mb-6 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Your Profile</h2>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Age</label>
                    <input
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) })}
                      className={`w-full px-4 py-3 border rounded-xl placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300 ${
                        darkMode 
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                          : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                      }`}
                      min="12"
                      max="90"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Gender</label>
                    <select
                      value={profile.gender}
                      onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:border-blue-500/50 transition-all duration-300 appearance-none cursor-pointer ${
                        darkMode 
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                          : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                      }`}
                    >
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Weight (kg)</label>
                    <input
                      type="number"
                      value={profile.weight}
                      onChange={(e) => setProfile({ ...profile, weight: parseFloat(e.target.value) })}
                      className={`w-full px-4 py-3 border rounded-xl placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300 ${
                        darkMode 
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                          : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                      }`}
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Height (cm)</label>
                    <input
                      type="number"
                      value={profile.height}
                      onChange={(e) => setProfile({ ...profile, height: parseFloat(e.target.value) })}
                      className={`w-full px-4 py-3 border rounded-xl placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300 ${
                        darkMode 
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                          : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                      }`}
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Fitness Goal</label>
                    <select
                      value={profile.goal}
                      onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:border-blue-500/50 transition-all duration-300 appearance-none cursor-pointer ${
                        darkMode 
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                          : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                      }`}
                    >
                      {goals.map((goal) => (
                        <option key={goal} value={goal}>{goal}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={analyzeProfile}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Analyzing...' : 'Analyze Profile'}
                  </button>
                </div>
              </div>
            </div>

            {/* Profile Results */}
            <div className="lg:col-span-2">
              {profileData ? (
                <div className="space-y-6">
                  <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
                    darkMode 
                      ? 'bg-slate-800/50 border-blue-500/20' 
                      : 'bg-white/80 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Your Stats</h3>
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/50">
                        <p className="text-sm font-medium">BMI</p>
                        <p className="text-3xl font-bold">{profileData.bmi}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                        <p className={`text-sm font-medium transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Age</p>
                        <p className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{profile.age}</p>
                      </div>
                      <div className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'}`}>
                        <p className={`text-sm font-medium transition-colors duration-500 ${darkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>Weight</p>
                        <p className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>{profile.weight} kg</p>
                      </div>
                      <div className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                        <p className={`text-sm font-medium transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Height</p>
                        <p className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{profile.height} cm</p>
                      </div>
                    </div>
                  </div>

                  <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
                    darkMode 
                      ? 'bg-slate-800/50 border-blue-500/20' 
                      : 'bg-white/80 border-blue-200'
                  }`}>
                    <h3 className={`text-2xl font-bold mb-4 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Recommended Workouts</h3>
                    <p className={`mb-6 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Personalized for: <span className="font-semibold text-cyan-400">{profileData.goal}</span></p>
                    <div className="grid gap-4">
                      {profileData.workouts.map((workout, index) => (
                        <div key={index} className={`backdrop-blur-sm border p-5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 ${darkMode ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20' : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'}`}>
                          <div className="flex items-start space-x-4">
                            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 shadow-lg shadow-blue-500/50">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className={`text-lg font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{workout.name}</h4>
                                {/* MODIFIED: Display calculated intensity */}
                                <div className="flex space-x-2">
                                  {renderIntensityBadge(workout.intensity)}
                                  <span className={`text-xs px-3 py-1 rounded-full border transition-colors duration-500 ${darkMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border-cyan-300'}`}>
                                    MET: {workout.met}
                                  </span>
                                </div>
                              </div>
                              <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{workout.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-12 text-center border transition-colors duration-500 ${
                  darkMode 
                    ? 'bg-slate-800/50 border-blue-500/20' 
                    : 'bg-white/80 border-blue-200'
                }`}>
                  <Target className={`h-16 w-16 mx-auto mb-4 transition-colors duration-500 ${darkMode ? 'text-blue-500/50' : 'text-blue-400'}`} />
                  <h3 className={`text-xl font-semibold mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Ready to Start?</h3>
                  <p className={`transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Fill in your profile and click "Analyze Profile" to get personalized recommendations</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'workouts' && (
          <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-8 border transition-colors duration-500 ${
            darkMode 
              ? 'bg-slate-800/50 border-blue-500/20' 
              : 'bg-white/80 border-blue-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Workout Library</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* MODIFIED: Mapping over exercise objects and using dynamic intensity */}
              {(Array.isArray(exercises) && exercises.length > 0) ? (
                exercises.map((ex) => (
                  (ex && ex.name) ? (
                    <div key={ex.name} className={`backdrop-blur-sm border p-6 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 group ${darkMode ? 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-lg font-bold group-hover:text-cyan-400 transition-colors duration-300 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{ex.name}</h3>
                        <Dumbbell className="h-6 w-6 text-cyan-500" />
                      </div>
                      <div className={`border px-4 py-2 rounded-lg inline-block transition-colors duration-500 ${darkMode ? 'bg-slate-900/50 border-blue-500/20' : 'bg-white border-blue-200'}`}>
                        <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Intensity</p>
                        <p className={`text-xl font-bold transition-colors duration-500 ${darkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>{ex.intensity}</p>
                      </div>
                    </div>
                  ) : null
                ))
              ) : (
                <div className="col-span-full text-center text-blue-400 py-8">
                  No exercises available. Try refreshing or check backend.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
              darkMode 
                ? 'bg-slate-800/50 border-blue-500/20' 
                : 'bg-white/80 border-blue-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-6 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Calorie Calculator</h2>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Exercise</label>
                  <select
                    value={calorieForm.exercise}
                    onChange={(e) => setCalorieForm({ ...calorieForm, exercise: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:border-blue-500/50 transition-all duration-300 appearance-none cursor-pointer ${
                      darkMode 
                        ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                        : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                    }`}
                  >
                    {/* MODIFIED: Use the name property for the option value/text */}
                    {(Array.isArray(exercises) && exercises.length > 0) ? (
                      exercises.map((ex) => (
                        (ex && ex.name) ? (
                          <option key={ex.name} value={ex.name}>{ex.name}</option>
                        ) : null
                      ))
                    ) : (
                      <option value="" disabled>No exercises available</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Duration (minutes)</label>
                  <input
                    type="number"
                    value={calorieForm.duration}
                    onChange={(e) => setCalorieForm({ ...calorieForm, duration: parseInt(e.target.value) })}
                    className={`w-full px-4 py-3 border rounded-xl placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300 ${
                      darkMode 
                        ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                        : 'bg-white border-slate-300 text-slate-900 focus:bg-blue-50'
                    }`}
                    min="5"
                    max="240"
                    step="5"
                  />
                </div>
                <button
                  onClick={estimateCalories}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-orange-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Calculating...' : 'Calculate Calories'}
                </button>
              </div>
            </div>

            <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
              darkMode 
                ? 'bg-slate-800/50 border-blue-500/20' 
                : 'bg-white/80 border-blue-200'
            }`}>
              {calorieData ? (
                <div>
                  <h3 className={`text-2xl font-bold mb-6 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Calorie Estimates</h3>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 backdrop-blur-sm border border-orange-500/20 p-6 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-orange-400 font-medium">AI Prediction</p>
                          <p className="text-4xl font-bold text-orange-300">{calorieData.predicted_calories}</p>
                          <p className={`text-sm mt-1 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>kcal burned</p>
                        </div>
                        <Flame className="h-12 w-12 text-orange-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                        <p className={`text-xs font-medium transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Physics-Based</p>
                        <p className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{calorieData.physics_based}</p>
                        <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>kcal</p>
                      </div>
                      <div className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'}`}>
                        <p className={`text-xs font-medium transition-colors duration-500 ${darkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>Dataset-Based</p>
                        <p className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>{calorieData.dataset_based}</p>
                        <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>kcal</p>
                      </div>
                    </div>
                    <div className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-slate-900/50 border-blue-500/20' : 'bg-white border-blue-200'}`}>
                      <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        <span className="font-semibold text-cyan-400">{calorieData.exercise}</span> for{' '}
                        <span className="font-semibold text-cyan-400">{calorieData.duration} minutes</span>
                      </p>
                      <p className={`text-xs mt-2 transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>MET Value: {calorieData.met}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Flame className={`h-16 w-16 mx-auto mb-4 transition-colors duration-500 ${darkMode ? 'text-blue-500/50' : 'text-blue-400'}`} />
                    <p className={`transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Select exercise and duration to calculate</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'nutrition' && (
          <div className="space-y-6">
            <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
              darkMode 
                ? 'bg-slate-800/50 border-blue-500/20' 
                : 'bg-white/80 border-blue-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-6 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Generate Meal Plan</h2>
              <button
                onClick={generateMealPlan}
                disabled={loading}
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Personalized Meal Plan'}
              </button>
            </div>

            {mealPlan && (
              <div className={`backdrop-blur-xl rounded-2xl shadow-2xl p-6 border transition-colors duration-500 ${
                darkMode 
                  ? 'bg-slate-800/50 border-blue-500/20' 
                  : 'bg-white/80 border-blue-200'
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Your Daily Meal Plan</h3>
                  <div className="text-right">
                    <p className="text-sm text-green-400">Target Calories</p>
                    <p className="text-3xl font-bold text-green-300">{mealPlan.target_calories}</p>
                    <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Total: {mealPlan.total_calories} kcal</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {Object.entries(mealPlan.meals).map(([meal, foods]) => (
                    <div key={meal} className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-500/20 p-6 rounded-xl">
                      <h4 className="text-xl font-bold text-green-300 mb-4 flex items-center">
                        <Utensils className="h-5 w-5 mr-2 text-green-400" />
                        {meal}
                      </h4>
                      <div className="space-y-3">
                        {foods.map((food, index) => (
                          <div key={index} className={`backdrop-blur-sm border p-4 rounded-xl transition-colors duration-500 ${darkMode ? 'bg-slate-900/50 border-green-500/20' : 'bg-white border-green-200'}`}>
                            <p className="font-semibold text-green-300 mb-2">{food.dish_name}</p>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <p className="text-xs text-orange-400">Calories</p>
                                <p className="font-bold text-orange-300">{food.calories.toFixed(1)}</p>
                              </div>
                              <div>
                                <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Protein</p>
                                <p className={`font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{food.protein.toFixed(1)}g</p>
                              </div>
                              <div>
                                <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>Carbs</p>
                                <p className={`font-bold transition-colors duration-500 ${darkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>{food.carbs.toFixed(1)}g</p>
                              </div>
                              <div>
                                <p className="text-xs text-green-400">Fibre</p>
                                <p className="font-bold text-green-300">{food.fibre.toFixed(1)}g</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'coach' && (
          <div className={`backdrop-blur-xl rounded-2xl shadow-2xl border transition-colors duration-500 h-[600px] flex flex-col ${
            darkMode 
              ? 'bg-slate-800/50 border-blue-500/20' 
              : 'bg-white/80 border-blue-200'
          }`}>
            {/* Coach Header */}
            <div className="p-6 border-b border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl shadow-lg">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      AI Fitness Coach
                    </h2>
                    <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Your personal fitness advisor
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearCoachHistory}
                  className={`p-2 rounded-lg transition-all duration-300 hover:scale-110 ${
                    darkMode 
                      ? 'bg-slate-700/50 hover:bg-slate-700 text-red-400' 
                      : 'bg-slate-100 hover:bg-slate-200 text-red-600'
                  }`}
                  title="Clear conversation"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {coachMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className={`h-16 w-16 mx-auto mb-4 transition-colors duration-500 ${darkMode ? 'text-purple-500/50' : 'text-purple-400'}`} />
                    <h3 className={`text-xl font-semibold mb-2 transition-colors duration-500 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      Start a conversation!
                    </h3>
                    <p className={`transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Ask me anything about fitness, nutrition, or your workout plan
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-3 max-w-md mx-auto">
                      <button
                        onClick={() => setCoachInput("What exercises should I do to lose weight?")}
                        className={`p-3 rounded-lg text-sm transition-all duration-300 ${
                          darkMode 
                            ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20' 
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        💪 Weight loss tips
                      </button>
                      <button
                        onClick={() => setCoachInput("How can I build muscle effectively?")}
                        className={`p-3 rounded-lg text-sm transition-all duration-300 ${
                          darkMode 
                            ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20' 
                            : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                        }`}
                      >
                        🏋️ Muscle building
                      </button>
                      <button
                        onClick={() => setCoachInput("What should I eat for better performance?")}
                        className={`p-3 rounded-lg text-sm transition-all duration-300 ${
                          darkMode 
                            ? 'bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20' 
                            : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                        }`}
                      >
                        🥗 Nutrition advice
                      </button>
                      <button
                        onClick={() => setCoachInput("How do I stay motivated?")}
                        className={`p-3 rounded-lg text-sm transition-all duration-300 ${
                          darkMode 
                            ? 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/20' 
                            : 'bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200'
                        }`}
                      >
                        ✨ Motivation tips
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {coachMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div
                        className={`max-w-[85%] p-5 rounded-2xl shadow-lg ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                            : darkMode
                              ? 'bg-slate-700/80 text-blue-50 border border-blue-500/30'
                              : 'bg-blue-50 text-blue-900 border border-blue-200'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="space-y-2">
                            {formatCoachMessage(msg.content)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {coachLoading && (
                    <div className="flex justify-start">
                      <div className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-700/50 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input Box */}
            <div className={`p-4 border-t transition-colors duration-500 ${darkMode ? 'border-blue-500/20 bg-slate-800/30' : 'border-blue-200 bg-white/50'}`}>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !coachLoading && sendCoachMessage()}
                  placeholder="Ask your AI fitness coach anything..."
                  className={`flex-1 px-4 py-3 border rounded-xl placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-all duration-300 ${
                    darkMode 
                      ? 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800' 
                      : 'bg-white border-slate-300 text-slate-900 focus:bg-purple-50'
                  }`}
                  disabled={coachLoading}
                />
                <button
                  onClick={sendCoachMessage}
                  disabled={coachLoading || !coachInput.trim()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                  title="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              
              {/* Quick suggestions */}
              {coachMessages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCoachInput("Can you explain my workout plan in detail?")}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all duration-300 ${
                      darkMode 
                        ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20' 
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    💪 Explain my plan
                  </button>
                  <button
                    onClick={() => setCoachInput("How can I improve my progress?")}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all duration-300 ${
                      darkMode 
                        ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20' 
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                    }`}
                  >
                    📈 Progress tips
                  </button>
                  <button
                    onClick={() => setCoachInput("What should I eat today?")}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all duration-300 ${
                      darkMode 
                        ? 'bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20' 
                        : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                    }`}
                  >
                    🥗 Nutrition advice
                  </button>
                </div>
              )}
              
              <p className={`text-xs mt-2 flex items-center transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <span className="mr-2">💡</span>
                {profileData ? 
                  'Your coach knows your profile and recommendations' : 
                  'Analyze your profile first for personalized advice'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={`relative z-10 backdrop-blur-xl border-t mt-12 transition-colors duration-500 ${darkMode ? 'bg-slate-800/30 border-blue-500/20' : 'bg-white/50 border-blue-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className={`text-sm flex items-center justify-center transition-colors duration-500 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            Made by Dev Garg, Divyansh Tyagi and Vishesh Aggarwal 
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;