import React, { useState, useEffect } from 'react';
import { generateScenarioExpressions } from '../services/gemini';
import { saveScenarioWithExpressions, getScenarios, getScenarioVocabulary, deleteScenario } from '../services/storage';
import { Scenario, ScenarioVocabularyItem } from '../types';

interface ScenarioGeneratorProps {
    userId: string;
}

const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({ userId }) => {
    const [scenarioInput, setScenarioInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedExpressions, setGeneratedExpressions] = useState<any[]>([]);
    const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
    const [scenarioVocab, setScenarioVocab] = useState<ScenarioVocabularyItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadScenarios();
    }, [userId]);

    const loadScenarios = async () => {
        const data = await getScenarios(userId);
        setSavedScenarios(data);
    };

    const handleGenerate = async () => {
        if (!scenarioInput.trim()) return;
        setIsGenerating(true);
        setGeneratedExpressions([]);
        try {
            const expressions = await generateScenarioExpressions(scenarioInput);
            setGeneratedExpressions(expressions);
        } catch (error) {
            console.error('Generation failed', error);
            alert('Failed to generate expressions. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (generatedExpressions.length === 0) return;
        setIsSaving(true);
        try {
            await saveScenarioWithExpressions(userId, scenarioInput, generatedExpressions);
            setScenarioInput('');
            setGeneratedExpressions([]);
            loadScenarios();
            alert('Scenario saved successfully!');
        } catch (error) {
            console.error('Save failed', error);
            alert('Failed to save scenario.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectScenario = async (scenario: Scenario) => {
        setSelectedScenario(scenario);
        const vocab = await getScenarioVocabulary(userId, scenario.id);
        setScenarioVocab(vocab);
    };

    const handleDeleteScenario = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this scenario?')) {
            try {
                await deleteScenario(id);
                if (selectedScenario?.id === id) {
                    setSelectedScenario(null);
                    setScenarioVocab([]);
                }
                loadScenarios();
            } catch (error) {
                console.error('Delete failed', error);
            }
        }
    };

    return (
        <div className="scenario-container">
            <div className="scenario-sidebar">
                <h3>Saved Scenarios</h3>
                <div className="scenario-list">
                    {savedScenarios.length === 0 && <p className="empty-msg">No scenarios saved yet.</p>}
                    {savedScenarios.map((s) => (
                        <div
                            key={s.id}
                            className={`scenario-card ${selectedScenario?.id === s.id ? 'active' : ''}`}
                            onClick={() => handleSelectScenario(s)}
                        >
                            <div className="scenario-card-header">
                                <span className="scenario-title">{s.title}</span>
                                <button className="delete-btn" onClick={(e) => handleDeleteScenario(s.id, e)}>×</button>
                            </div>
                            <span className="scenario-date">{new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="scenario-main">
                <div className="scenario-input-section">
                    <h2>New Scenario</h2>
                    <p className="subtitle">Describe a situation (e.g., "ordering food at a busy cafe" or "negotiating a salary") to get essential expressions.</p>
                    <div className="input-group">
                        <textarea
                            placeholder="I am at a subway station and I'm lost..."
                            value={scenarioInput}
                            onChange={(e) => setScenarioInput(e.target.value)}
                            disabled={isGenerating}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !scenarioInput.trim()}
                            className="generate-btn"
                        >
                            {isGenerating ? 'Generating...' : 'Generate Expressions'}
                        </button>
                    </div>
                </div>

                {generatedExpressions.length > 0 && (
                    <div className="results-section animate-fade-in">
                        <div className="results-header">
                            <h3>Generated Expressions</h3>
                            <button onClick={handleSave} disabled={isSaving} className="save-btn">
                                {isSaving ? 'Saving...' : 'Save Scenario'}
                            </button>
                        </div>
                        <div className="results-grid">
                            {generatedExpressions.map((exp, i) => (
                                <div key={i} className="expression-preview-card">
                                    <div className="exp-header">
                                        <strong>{exp.expression}</strong>
                                        <span className="phonetic">{exp.phonetic}</span>
                                    </div>
                                    <p className="definition">{exp.definition}</p>
                                    <div className="examples">
                                        {exp.examples.map((ex: string, j: number) => (
                                            <p key={j} className="example">"{ex}"</p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedScenario && !isGenerating && generatedExpressions.length === 0 && (
                    <div className="results-section">
                        <h3>{selectedScenario.title}</h3>
                        <div className="results-grid">
                            {scenarioVocab.map((exp) => (
                                <div key={exp.id} className="expression-preview-card">
                                    <div className="exp-header">
                                        <strong>{exp.expression}</strong>
                                        <span className="phonetic">{exp.phonetic}</span>
                                    </div>
                                    <p className="definition">{exp.definition}</p>
                                    <div className="examples">
                                        {exp.examples.map((ex: string, j: number) => (
                                            <p key={j} className="example">"{ex}"</p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .scenario-container {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 2rem;
          height: calc(100vh - 120px);
          padding: 1rem;
        }

        .scenario-sidebar {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow-y: auto;
        }

        .scenario-sidebar h3 {
          margin-bottom: 1.5rem;
          font-size: 1.1rem;
          color: #fff;
        }

        .scenario-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .scenario-card {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .scenario-card:hover {
          background: rgba(255, 255, 255, 0.07);
        }

        .scenario-card.active {
          background: rgba(100, 108, 255, 0.1);
          border-color: #646cff;
        }

        .scenario-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.5rem;
        }

        .scenario-title {
          font-weight: 500;
          color: #eee;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .scenario-date {
          font-size: 0.8rem;
          color: #888;
        }

        .delete-btn {
            background: none;
            border: none;
            color: #888;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 0 0.2rem;
            line-height: 1;
        }

        .delete-btn:hover {
            color: #ff4d4d;
        }

        .scenario-main {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          overflow-y: auto;
          padding-right: 1rem;
        }

        .scenario-input-section h2 {
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: #888;
          margin-bottom: 1.5rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        textarea {
          width: 100%;
          min-height: 120px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
          color: #fff;
          font-family: inherit;
          resize: vertical;
        }

        textarea:focus {
          outline: none;
          border-color: #646cff;
        }

        .generate-btn {
          background: #646cff;
          color: white;
          padding: 0.8rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.1s;
        }

        .generate-btn:hover:not(:disabled) {
          background: #747bff;
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .results-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .save-btn {
          background: #10b981;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        .expression-preview-card {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          padding: 1.25rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .exp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .exp-header strong {
          font-size: 1.1rem;
          color: #646cff;
        }

        .phonetic {
          font-size: 0.85rem;
          color: #888;
        }

        .definition {
          font-size: 0.95rem;
          color: #ddd;
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .examples {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 0.75rem;
        }

        .example {
          font-size: 0.85rem;
          color: #aaa;
          font-style: italic;
        }

        .empty-msg {
          text-align: center;
          color: #666;
          margin-top: 2rem;
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .scenario-container {
            grid-template-columns: 1fr;
            height: auto;
          }
          .scenario-sidebar {
            order: 2;
            max-height: 300px;
          }
        }
      `}</style>
        </div>
    );
};

export default ScenarioGenerator;
