import React, { useEffect, useRef, useState } from 'react';
import { FitnessEngine } from './FitnessEngine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Label } from 'recharts';

// Configuration
const THEME = {
  bg: 'bg-slate-900',
  panel: 'bg-slate-800',
  accent: 'text-indigo-400',
  button: 'bg-indigo-600 hover:bg-indigo-500',
  gridBorder: 'border-slate-700',
  text: 'text-slate-200',
  textDim: 'text-slate-400'
};

const CANVAS_PIXEL_SIZE = 500; 
const INITIAL_GRID_SIZE = 20;  

const COLORS = {
  0: '#0f172a', // Unoccupied 
  1: '#fbbf24', // Occupied
  2: '#334155'  // Depleted
};

export default function GameInterface() {
  const canvasRef = useRef(null);
  
  // Initialize Engine
  const engineRef = useRef(new FitnessEngine(INITIAL_GRID_SIZE, INITIAL_GRID_SIZE));
  const requestRef = useRef(null);
  const lastUpdateRef = useRef(0);
  
  // Game State
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([{ n: 0, Sn: 1 }]);
  const [gridSize, setGridSize] = useState(INITIAL_GRID_SIZE);
  const [speed, setSpeed] = useState(10);
  
  // Defaults
  const [params, setParams] = useState({ alpha: 0, level: 19, maxTimeSteps: 100 });
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    engineRef.current.alpha = 0;
    engineRef.current.level = 19;
    engineRef.current.maxTimeSteps = 100;
    engineRef.current.reset();
    draw();
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // GAME LOOP
  const animate = (timestamp) => {
    const interval = 1000 / speed;
    const delta = timestamp - lastUpdateRef.current;

    if (delta > interval) {
      engineRef.current.step();
      draw();
      
      const gen = engineRef.current.generation;
      const pop = countPopulation();
      
      if (!engineRef.current.isRunning && running) {
         setRunning(false);
      }

      setHistory(prev => {
         if (prev.length > 0 && prev[prev.length-1].n === gen) return prev;
         const newData = [...prev, { n: gen, Sn: pop }];
         return newData.slice(-150);
      });
      
      lastUpdateRef.current = timestamp - (delta % interval);
    }

    if (engineRef.current.isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  const countPopulation = () => {
    let pop = 0;
    const grid = engineRef.current.grid;
    for(let i=0; i<grid.length; i++) if(grid[i]===1) pop++;
    return pop;
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const engine = engineRef.current;
    
    const cellSize = CANVAS_PIXEL_SIZE / engine.width;

    // Clear background
    ctx.fillStyle = '#0f172a'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines 
    if (cellSize > 4) {
        ctx.strokeStyle = '#1e293b'; // Grid line color
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Vertical lines
        for (let x = 0; x <= engine.width; x++) {
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, canvas.height);
        }
        // Horizontal lines
        for (let y = 0; y <= engine.height; y++) {
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(canvas.width, y * cellSize);
        }
        ctx.stroke();
    }

    // Draw Cells
    for (let i = 0; i < engine.size; i++) {
        const state = engine.grid[i];
        if (state !== 0) {
          const x = i % engine.width;
          const y = Math.floor(i / engine.width);
          
          ctx.fillStyle = COLORS[state];
          
          // Slight padding to respect grid lines
          const padding = cellSize > 8 ? 1 : 0;
          const radius = cellSize > 15 ? 2 : 0;

          ctx.beginPath();
          ctx.roundRect(x * cellSize + padding, y * cellSize + padding, cellSize - (padding*2), cellSize - (padding*2), radius);
          ctx.fill();
        }
    }
  };

 



  const handleCanvasClick = (e) => {
    // Only allow editing at the very start (Generation 0)
    if (engineRef.current.generation > 0) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Responsive scaling calculations
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cellWidth = CANVAS_PIXEL_SIZE / engineRef.current.width;
    const cellHeight = CANVAS_PIXEL_SIZE / engineRef.current.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellWidth);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / cellHeight);

   
    engineRef.current.toggleCell(x, y);
    draw();

    const pop = countPopulation();
    setHistory([{ n: 0, Sn: pop }]); 
  };

  // Handlers
  const handleGridResize = (e) => {
    const newSize = parseInt(e.target.value);
    setGridSize(newSize);
    setRunning(false);
    cancelAnimationFrame(requestRef.current);
    
    const newMaxRho = newSize - 1;
    let newLevel = params.level;
    if (newLevel > newMaxRho) newLevel = newMaxRho;

    setParams(prev => ({ ...prev, level: newLevel }));

    engineRef.current = new FitnessEngine(newSize, newSize);
    engineRef.current.alpha = params.alpha;
    engineRef.current.level = newLevel; 
    engineRef.current.maxTimeSteps = params.maxTimeSteps;
    
    engineRef.current.reset();
    setHistory([{ n: 0, Sn: 1 }]);
    
    setTimeout(draw, 0);
  };

  const handleSpeedChange = (e) => setSpeed(parseInt(e.target.value));

  const togglePlay = () => {
    if (!engineRef.current.isRunning) {
        if (engineRef.current.generation >= params.maxTimeSteps) {
             engineRef.current.reset();
             setHistory([{ n: 0, Sn: 1 }]);
        }
        lastUpdateRef.current = performance.now();
        engineRef.current.isRunning = true;
        setRunning(true);
        requestRef.current = requestAnimationFrame(animate);
    } else {
        engineRef.current.isRunning = false;
        setRunning(false);
        cancelAnimationFrame(requestRef.current);
    }
  };

  const resetGame = () => {
    engineRef.current.isRunning = false;
    setRunning(false);
    cancelAnimationFrame(requestRef.current);
    engineRef.current.reset();
    setHistory([{ n: 0, Sn: 1 }]);
    draw();
  };

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    const val = parseFloat(value);
    setParams(prev => ({ ...prev, [name]: val }));
    if (name === 'alpha') engineRef.current.alpha = val;
    if (name === 'level') engineRef.current.level = val;
    if (name === 'maxTimeSteps') engineRef.current.maxTimeSteps = val;
  };

  const maxRho = Math.max(1, gridSize - 1);

  return (
    <div className={`flex flex-col min-h-screen ${THEME.bg} text-slate-200 font-sans overflow-x-hidden`}>
      
      {/* Header */}
      <div className="py-4 px-8 flex items-center justify-between border-b border-slate-800/50 backdrop-blur-sm bg-slate-900/80 sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Game of <span className="text-indigo-400">Fitness</span>
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Bet-hedging via Kelly betting</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 p-4">
        
        {/* Left: Grid Canvas */}
        <div className="relative group shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick} 
            width={CANVAS_PIXEL_SIZE}
            height={CANVAS_PIXEL_SIZE}
            className="relative rounded-lg border border-slate-700 shadow-2xl bg-slate-950 cursor-pointer" 
            style={{ maxWidth: '100%', height: 'auto', maxHeight: '60vh' }} 
          />
        </div>

        {/* Right: Controls */}
        <div className={`w-full max-w-[340px] ${THEME.panel} rounded-2xl shadow-xl border border-slate-700/50 flex flex-col overflow-hidden`}>
          
          <div className="px-5 py-3 border-b border-slate-700/50 bg-slate-800/50">
            <h2 className="font-bold text-md text-white">Parameters</h2>
          </div>

          <div className="p-5 flex flex-col gap-4">
            
            {/* Grid Size & Speed */}
            <div className="flex gap-4">
               <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-300">Size</span>
                    <span className="text-xs font-mono text-indigo-400">{gridSize}</span>
                  </div>
                  <input type="range" min="10" max="100" step="10" value={gridSize} onChange={handleGridResize} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
               </div>
               <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-300">Speed</span>
                    <span className="text-xs font-mono text-indigo-400">{speed}</span>
                  </div>
                  <input type="range" min="1" max="60" step="1" value={speed} onChange={handleSpeedChange} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
               </div>
            </div>

            <hr className="border-slate-700" />

            {/* Simulation Sliders */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">Max Time Steps (N)</span>
                  <span className="text-xs font-mono text-indigo-400">{params.maxTimeSteps}</span>
                </div>
                <input type="range" name="maxTimeSteps" min="50" max="500" step="10" value={params.maxTimeSteps} onChange={handleParamChange} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">Information (α)</span>
                  <span className="text-xs font-mono text-indigo-400">{params.alpha}</span>
                </div>
                <input type="range" name="alpha" min="0" max="1" step="0.05" value={params.alpha} onChange={handleParamChange} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">Moore Radius (ρ)</span>
                  <span className="text-xs font-mono text-indigo-400">{params.level}</span>
                </div>
                <input type="range" name="level" min="1" max={maxRho} step="1" value={params.level} onChange={handleParamChange} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
              </div>
            </div>

            {/* Live Graph */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-3 flex flex-col h-48">
               <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Population Trend</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="text-[10px] font-mono text-indigo-300">LIVE: {history[history.length-1]?.Sn}</span>
                  </div>
               </div>
               
               <div className="flex-1 w-full min-h-0 pl-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ bottom: 15, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      
                      <XAxis dataKey="n" tick={{fontSize: 9, fill: '#64748b'}} interval="preserveStartEnd">
                        <Label value="Time Steps (n)" offset={0} position="insideBottom" style={{fontSize: '10px', fill: '#94a3b8'}} />
                      </XAxis>
                      
                      <YAxis tick={{fontSize: 9, fill: '#64748b'}} width={45}>
                         <Label value="Population (Sn)" angle={-90} position="insideLeft" style={{fontSize: '10px', fill: '#94a3b8', textAnchor: 'middle'}} />
                      </YAxis>

                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                        itemStyle={{ color: '#818cf8' }}
                      />
                      <Line type="monotone" dataKey="Sn" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="sticky bottom-0 py-4 flex items-center justify-center bg-gradient-to-t from-slate-900 to-transparent pointer-events-none z-10">
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-full px-6 py-2 shadow-2xl flex items-center gap-4 pointer-events-auto">
          <button onClick={() => setShowExplanation(true)} className="px-4 py-2 rounded-full font-semibold text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2">
            <span className="font-serif font-bold italic bg-slate-600 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white">i</span>
            <span>Explanation</span>
          </button>
          
          <div className="w-px h-6 bg-slate-600 mx-2"></div>
          
          <button onClick={togglePlay} className={`px-6 py-2 rounded-full font-bold text-white text-sm shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 ${running ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
             {running ? 'PAUSE' : 'START'}
          </button>
          
          <button onClick={resetGame} className="px-4 py-2 rounded-full font-semibold text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Explanation Modal (FULL) */}
      {showExplanation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-2xl font-bold text-white">How it Works</h2>
              <button onClick={() => setShowExplanation(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">&times;</button>
            </div>
            
            
            {/* Modal Content */}
            <div className="p-8 space-y-8 overflow-y-auto">
              
              {/* Section 1: Intro */}
              <section>
                <h3 className="text-xl font-bold text-white mb-3">The Concept</h3>
                <p className="text-slate-300 leading-relaxed">
                  The <strong className="text-indigo-400">Game of Fitness</strong> is an evolutionary simulation based on the <strong>Kelly Criterion</strong>. Unlike Conway's Game of Life, organisms here act like investors: they must decide what fraction of their population to "bet" on reproduction based on available resources.
                </p>
              </section>

              {/* Section 2: Legend */}
              <section>
                <h3 className="text-lg font-bold text-white mb-3">The Environment</h3>
                <div className="grid grid-cols-1 gap-3">
                   {/* Occupied */}
                   <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="w-10 h-10 shrink-0 rounded-md shadow-inner bg-amber-400 border border-amber-300/20"></div>
                      <div>
                          <h4 className="font-bold text-white text-sm">Occupied Tile</h4>
                          <p className="text-xs text-slate-400">A living organism. It occupies a fertile tile.</p>
                      </div>
                   </div>
                   {/* Unoccupied */}
                   <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="w-10 h-10 shrink-0 rounded-md shadow-inner bg-slate-950 border border-slate-700"></div>
                      <div>
                          <h4 className="font-bold text-white text-sm">Unoccupied Tile</h4>
                          <p className="text-xs text-slate-400">Habitable space containing resources (food).</p>
                      </div>
                   </div>
                   {/* Depleted */}
                   <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div className="w-10 h-10 shrink-0 rounded-md shadow-inner bg-slate-700"></div>
                      <div>
                          <h4 className="font-bold text-white text-sm">Depleted Tile</h4>
                          <p className="text-xs text-slate-400">Dead space where reproduction failed. No life can exist here.</p>
                      </div>
                   </div>
                </div>
              </section>

              {/* Section 3: The Strategy */}
              <section>
                <h3 className="text-lg font-bold text-white mb-2">The Strategy (Kelly Betting)</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  At every time step, the population calculates the probability of success based on the density of the grid.
                </p>
                <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 ml-2">
                  <li><strong className="text-indigo-300">High Resources:</strong> If space is abundant, the population bets aggressively (high reproduction).</li>
                  <li><strong className="text-indigo-300">Low Resources:</strong> If space is scarce, the population becomes conservative (dormancy) to avoid ruin.</li>
                </ul>
              </section>

              {/* Section 4: Algorithm */}
              <section>
                <h3 className="text-lg font-bold text-white mb-2">The Simulation Cycle</h3>
                <div className="space-y-3 text-sm text-slate-300 border-l-2 border-indigo-500/30 pl-4">
                  <div>
                    <strong className="text-white block">1. Selection</strong>
                    <span className="text-slate-400">A fraction of organisms is selected to reproduce based on the Kelly bet.</span>
                  </div>
                  <div>
                    <strong className="text-white block">2. Reproduction</strong>
                    <span className="text-slate-400">Selected organisms choose a target tile based on their mobility (ρ) and information parameters (α).</span>
                  </div>
                  <div>
                    <strong className="text-white block">3. Evaluation</strong>
                    <span className="text-slate-400">If the target is <span className="text-slate-200">Empty</span>, a new organism is born. If the target is <span className="text-amber-400">Occupied</span> or <span className="text-slate-500">Depleted</span>, the parent dies.</span>
                  </div>
                </div>
              </section>

              {/* Section 5: Parameters */}
              <div className="bg-slate-800/50 p-5 rounded-lg border border-slate-700/50">
                  <h4 className="font-bold text-indigo-400 mb-3 text-sm uppercase tracking-wider">Control Parameters</h4>
                  <ul className="space-y-3 text-sm text-slate-300">
                      <li>
                        <strong className="text-white block">Alpha (α) - Information</strong>
                        <span className="text-slate-400">Determines environmental awareness. <strong>0</strong> is random movement; <strong>1</strong> is perfect avoidance of obstacles.</span>
                      </li>
                      <li>
                        <strong className="text-white block">Rho (ρ) - Moore Radius</strong>
                        <span className="text-slate-400">Defines the reproduction range. A higher radius allows organisms to "jump" over depleted zones.</span>
                      </li>
                      <li>
                        <strong className="text-white block">Max Time Steps (N)</strong>
                        <span className="text-slate-400">The simulation automatically stops after this many generations.</span>
                      </li>
                  </ul>
              </div>

              {/* Section 6: More info */}
              <section>
                <h3 className="text-lg font-bold text-white mb-2">More Information</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  This simulation is part of the research paper "<em className="italic">Bet-hedging via Kelly betting in a limited environment leads to logistic growth in the Game of Fitness</em>", Scientific Reports, 2026, by Fatih Gulec, Takhmina Iliiasova, Nigel Wallbridge, and Andrew W. Eckford.
                </p>
                <a 
                 href="https://www.nature.com/articles/s41598-026-47388-8"
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors"
               >
                 Read the Paper &rarr;
               </a>
              </section>

            </div>

            <div className="p-4 bg-slate-800/50 border-t border-slate-800 text-center">
               <button onClick={() => setShowExplanation(false)} className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">Close Guide</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
