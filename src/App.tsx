import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Stethoscope, 
  Baby, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Camera, 
  History,
  AlertCircle,
  Loader2,
  X,
  Globe,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  LogOut
} from 'lucide-react';
import { SymptomCheck, DiagnosisResult, MalnutritionResult, HealthCase, Language } from './types';
import { getDiagnosis, analyzeMalnutrition } from './services/geminiService';
import { auth, db, signIn, logOut, handleFirestoreError, OperationType } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';

const translations = {
  en: {
    title: "HealthHelper",
    symptoms: "Symptoms",
    nutrition: "Nutrition",
    history: "History",
    fever: "Hot Body (Fever) 🌡️",
    feverDesc: "Body feels very hot",
    cough: "Cough 🗣️",
    coughDesc: "Persistent coughing",
    breathing: "Breathing Trouble 🫁",
    breathingDesc: "Fast or hard breathing",
    age: "Patient Age",
    child: "Child",
    adult: "Adult",
    check: "Check Diagnosis",
    analyze: "Analyze Photo",
    tapPhoto: "Tap to add photo",
    photoDesc: "Show the child's body",
    result: "Result",
    diagnosis: "Likely Problem",
    severity: "How Bad It Is",
    action: "What To Do",
    confidence: "AI Confidence",
    newCheck: "Start New Check",
    noHistory: "No history yet",
    recentCases: "Recent Cases",
    outbreakMalaria: "⚠️ Possible malaria outbreak in this area",
    outbreakPneumonia: "⚠️ Possible pneumonia cluster detected",
    danger: "DANGER",
    yes: "YES",
    no: "NO",
    emergency: "EMERGENCY",
    urgent: "URGENT",
    mild: "MILD",
    loginTitle: "CHV Login",
    loginDesc: "Please sign in to record health cases securely.",
    loginBtn: "Sign in with Google"
  },
  ha: {
    title: "Mataimakin Lafiya",
    symptoms: "Alamomi",
    nutrition: "Abinci",
    history: "Tarihi",
    fever: "Zazzabi (Jiki da zafi) 🌡️",
    feverDesc: "Jiki yana da zafi sosai",
    cough: "Tari 🗣️",
    coughDesc: "Tari akai-akai",
    breathing: "Numfashi da kyar 🫁",
    breathingDesc: "Numfashi da sauri ko wahala",
    age: "Shekarun Mara lafiya",
    child: "Yaro",
    adult: "Babba",
    check: "Duba Matsala",
    analyze: "Duba Hoto",
    tapPhoto: "Taba nan don saka hoto",
    photoDesc: "Nuna jikin yaron",
    result: "Sakamako",
    diagnosis: "Abinda ke damunsa",
    severity: "Yadda yake",
    action: "Abinda za'a yi",
    confidence: "Tabbacin AI",
    newCheck: "Sake Dubawa",
    noHistory: "Babu tarihin tukunna",
    recentCases: "Cases na baya-bayan nan",
    outbreakMalaria: "⚠️ Akwai yiwuwar barkewar zazzabin cizon sauro a nan",
    outbreakPneumonia: "⚠️ Akwai yiwuwar barkewar ciwon huhu (Pneumonia) a nan",
    danger: "HADARI",
    yes: "EH",
    no: "A'A",
    emergency: "HADARI SOSAI",
    urgent: "DA GUMU",
    mild: "BA SOSAI BA",
    loginTitle: "Shiga CHV",
    loginDesc: "Don Allah shiga don adana bayanan lafiya cikin tsaro.",
    loginBtn: "Shiga da Google"
  }
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<'symptoms' | 'malnutrition' | 'history'>('symptoms');
  const [cases, setCases] = useState<HealthCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'diagnosis'; data: DiagnosisResult } | { type: 'malnutrition'; data: MalnutritionResult } | null>(null);
  
  const t = translations[lang];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setCases([]);
      return;
    }
    const q = query(collection(db, 'cases'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthCase));
      setCases(fetchedCases);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cases');
    });
    return unsubscribe;
  }, [user]);

  // Symptom Form State
  const [symptoms, setSymptoms] = useState<SymptomCheck>({
    fever: false,
    cough: false,
    difficultyBreathing: false,
    age: 'child'
  });

  // Malnutrition Image State
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced Outbreak logic (last 10 cases)
  const recentCases = cases.slice(0, 10);
  const feverCasesCount = recentCases.filter(c => c.symptoms.fever).length;
  const breathingCasesCount = recentCases.filter(c => c.symptoms.difficultyBreathing).length;
  
  const malariaOutbreak = feverCasesCount >= 3;
  const pneumoniaOutbreak = breathingCasesCount >= 3;

  const handleSymptomSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const diagnosis = await getDiagnosis(symptoms);
      const newCase: HealthCase = {
        id: crypto.randomUUID(),
        userId: user.uid,
        timestamp: Date.now(),
        symptoms: { ...symptoms },
        diagnosis
      };
      
      // Save to Firestore
      try {
        await setDoc(doc(db, 'cases', newCase.id), newCase);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cases/${newCase.id}`);
      }
      
      setResult({ type: 'diagnosis', data: diagnosis });
    } catch (error) {
      console.error("Diagnosis failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMalnutritionSubmit = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const analysis = await analyzeMalnutrition(image);
      setResult({ type: 'malnutrition', data: analysis });
    } catch (error) {
      console.error("Malnutrition analysis failed", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setSymptoms({ fever: false, cough: false, difficultyBreathing: false, age: 'child' });
    setImage(null);
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full text-center space-y-6">
          <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
            <Stethoscope className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t.loginTitle}</h1>
            <p className="text-slate-500 mt-2">{t.loginDesc}</p>
          </div>
          <button 
            onClick={signIn}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors"
          >
            {t.loginBtn}
          </button>
          <button 
            onClick={() => setLang(lang === 'en' ? 'ha' : 'en')}
            className="flex items-center gap-2 mx-auto text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Globe className="w-4 h-4" />
            {lang === 'en' ? 'Switch to Hausa' : 'Switch to English'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Stethoscope className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang(lang === 'en' ? 'ha' : 'en')}
              className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200"
            >
              <Globe className="w-3 h-3" />
              {lang === 'en' ? 'HA' : 'EN'}
            </button>
            <button onClick={logOut} className="p-1.5 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>


      <main className="max-w-md mx-auto p-4">
        {/* Outbreak Banners */}
        <AnimatePresence>
          {(malariaOutbreak || pneumoniaOutbreak) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 space-y-2 overflow-hidden"
            >
              {malariaOutbreak && (
                <div className="bg-red-600 text-white p-4 rounded-2xl shadow-lg flex items-start gap-3 border-2 border-red-400 animate-pulse">
                  <ShieldAlert className="w-6 h-6 shrink-0 mt-1" />
                  <p className="font-bold text-sm leading-tight">{t.outbreakMalaria}</p>
                </div>
              )}
              {pneumoniaOutbreak && (
                <div className="bg-orange-600 text-white p-4 rounded-2xl shadow-lg flex items-start gap-3 border-2 border-orange-400">
                  <AlertCircle className="w-6 h-6 shrink-0 mt-1" />
                  <p className="font-bold text-sm leading-tight">{t.outbreakPneumonia}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
          {result ? (
            <ResultView result={result} onReset={resetForm} t={t} />
          ) : (
            <>
              {activeTab === 'symptoms' && (
                <SymptomForm 
                  symptoms={symptoms} 
                  setSymptoms={setSymptoms} 
                  onSubmit={handleSymptomSubmit} 
                  loading={loading}
                  t={t}
                />
              )}
              {activeTab === 'malnutrition' && (
                <MalnutritionForm 
                  image={image} 
                  onImageClick={() => fileInputRef.current?.click()} 
                  onSubmit={handleMalnutritionSubmit}
                  loading={loading}
                  t={t}
                />
              )}
              {activeTab === 'history' && (
                <HistoryView cases={cases} t={t} />
              )}
            </>
          )}
        </div>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload}
        />
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <NavButton 
            active={activeTab === 'symptoms'} 
            onClick={() => { setActiveTab('symptoms'); setResult(null); }}
            icon={<Stethoscope />}
            label={t.symptoms}
          />
          <NavButton 
            active={activeTab === 'malnutrition'} 
            onClick={() => { setActiveTab('malnutrition'); setResult(null); }}
            icon={<Baby />}
            label={t.nutrition}
          />
          <NavButton 
            active={activeTab === 'history'} 
            onClick={() => { setActiveTab('history'); setResult(null); }}
            icon={<History />}
            label={t.history}
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-blue-600' : 'text-slate-400'}`}
    >
      <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-blue-50' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function SymptomForm({ symptoms, setSymptoms, onSubmit, loading, t }: { 
  symptoms: SymptomCheck, 
  setSymptoms: (s: SymptomCheck) => void, 
  onSubmit: () => void,
  loading: boolean,
  t: any
}) {
  const toggleSymptom = (key: keyof Omit<SymptomCheck, 'age'>) => {
    setSymptoms({ ...symptoms, [key]: !symptoms[key] });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">{t.symptoms}</h2>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <BigToggleButton 
          active={symptoms.fever} 
          onClick={() => toggleSymptom('fever')}
          label={t.fever}
          description={t.feverDesc}
          t={t}
        />
        <BigToggleButton 
          active={symptoms.cough} 
          onClick={() => toggleSymptom('cough')}
          label={t.cough}
          description={t.coughDesc}
          t={t}
        />
        <BigToggleButton 
          active={symptoms.difficultyBreathing} 
          onClick={() => toggleSymptom('difficultyBreathing')}
          label={t.breathing}
          description={t.breathingDesc}
          t={t}
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t.age}</label>
        <div className="flex gap-2">
          <button 
            onClick={() => setSymptoms({ ...symptoms, age: 'child' })}
            className={`flex-1 py-4 rounded-2xl font-bold border-2 transition-all ${symptoms.age === 'child' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            {t.child}
          </button>
          <button 
            onClick={() => setSymptoms({ ...symptoms, age: 'adult' })}
            className={`flex-1 py-4 rounded-2xl font-bold border-2 transition-all ${symptoms.age === 'adult' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            {t.adult}
          </button>
        </div>
      </div>

      <button 
        disabled={loading}
        onClick={onSubmit}
        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" /> : t.check}
        {!loading && <ChevronRight />}
      </button>
    </div>
  );
}

function BigToggleButton({ active, onClick, label, description, t }: { active: boolean, onClick: () => void, label: string, description: string, t: any }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${active ? 'bg-blue-50 border-blue-600 shadow-sm' : 'bg-white border-slate-100'}`}
    >
      <div>
        <div className={`font-bold text-lg ${active ? 'text-blue-700' : 'text-slate-800'}`}>{label}</div>
        <div className="text-slate-400 text-xs">{description}</div>
      </div>
      <div className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
        {active ? t.yes : t.no}
      </div>
    </button>
  );
}

function MalnutritionForm({ image, onImageClick, onSubmit, loading, t }: { 
  image: string | null, 
  onImageClick: () => void, 
  onSubmit: () => void,
  loading: boolean,
  t: any
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">{t.nutrition}</h2>
        <p className="text-slate-500 text-sm">{t.photoDesc}</p>
      </div>

      <div 
        onClick={onImageClick}
        className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer overflow-hidden transition-all ${image ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
      >
        {image ? (
          <img src={image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <>
            <div className="bg-white p-4 rounded-full shadow-sm">
              <Camera className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-center px-6">
              <div className="font-bold text-slate-600">{t.tapPhoto}</div>
            </div>
          </>
        )}
      </div>

      <button 
        disabled={!image || loading}
        onClick={onSubmit}
        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" /> : t.analyze}
        {!loading && <ChevronRight />}
      </button>
    </div>
  );
}

function ResultView({ result, onReset, t }: { result: { type: 'diagnosis'; data: DiagnosisResult } | { type: 'malnutrition'; data: MalnutritionResult }, onReset: () => void, t: any }) {
  const isDiagnosis = result.type === 'diagnosis';
  const data = result.data;

  const getSeverityLabel = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'emergency': return t.emergency;
      case 'urgent': return t.urgent;
      case 'high': return t.emergency;
      case 'moderate': return t.urgent;
      default: return t.mild;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'emergency': return 'bg-red-600 text-white border-red-400';
      case 'urgent': return 'bg-orange-500 text-white border-orange-300';
      case 'high': return 'bg-red-600 text-white border-red-400';
      case 'moderate': return 'bg-orange-500 text-white border-orange-300';
      default: return 'bg-green-600 text-white border-green-400';
    }
  };

  const currentSeverity = isDiagnosis ? (data as DiagnosisResult).severity : (data as MalnutritionResult).riskLevel;
  const isEmergency = currentSeverity.toLowerCase() === 'emergency' || currentSeverity.toLowerCase() === 'high';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">{t.result}</h2>
        <button onClick={onReset} className="p-2 hover:bg-slate-100 rounded-full">
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <div className="space-y-4">
        {isEmergency && (
          <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700">
            <ShieldAlert className="w-8 h-8 shrink-0" />
            <div className="font-black text-lg uppercase tracking-tight">{t.danger}</div>
          </div>
        )}

        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            {isDiagnosis ? t.diagnosis : t.result}
          </label>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-slate-900">
              {isDiagnosis ? (data as DiagnosisResult).likelyDiagnosis : (data as MalnutritionResult).riskLevel}
            </div>
            <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter border-2 ${getSeverityColor(isDiagnosis ? (data as DiagnosisResult).severity : (data as MalnutritionResult).riskLevel)}`}>
              {getSeverityLabel(isDiagnosis ? (data as DiagnosisResult).severity : (data as MalnutritionResult).riskLevel)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t.action}</label>
          <div className={`p-4 rounded-2xl font-bold leading-relaxed border-2 ${isEmergency ? 'bg-red-50 border-red-200 text-red-900' : 'bg-blue-50 border-blue-100 text-blue-900'}`}>
            {isDiagnosis ? (data as DiagnosisResult).recommendedAction : (data as MalnutritionResult).advice}
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{t.confidence}</label>
            <div className="font-bold text-slate-700">{data.confidence}</div>
          </div>
          <div className="flex gap-1">
            {data.confidence === 'High' ? <ThumbsUp className="text-green-500" /> : <ThumbsDown className="text-orange-400" />}
          </div>
        </div>
      </div>

      <button 
        onClick={onReset}
        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all"
      >
        {t.newCheck}
      </button>
    </motion.div>
  );
}

function HistoryView({ cases, t }: { cases: HealthCase[], t: any }) {
  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-slate-50 p-6 rounded-full mb-4">
          <History className="w-12 h-12 text-slate-200" />
        </div>
        <h3 className="font-bold text-slate-800">{t.noHistory}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">{t.recentCases}</h2>
      <div className="space-y-3">
        {cases.map((c) => (
          <div key={c.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">{c.diagnosis?.likelyDiagnosis || 'Unknown'}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {c.symptoms.age === 'child' ? t.child : t.adult}
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              c.diagnosis?.severity === 'Emergency' ? 'bg-red-100 text-red-600' : 
              c.diagnosis?.severity === 'Urgent' ? 'bg-orange-100 text-orange-600' : 
              'bg-green-100 text-green-600'
            }`}>
              {c.diagnosis?.severity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
