from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.engine.ai_assistant import ai_assistant, AIProblemAnalysisResult

router = APIRouter(prefix="/ai-assistant", tags=["Intelligent Optimization Assistant"])

class AIAnalyzeRequest(BaseModel):
    problem_description: str

@router.post("/formulate", response_model=AIProblemAnalysisResult)
def formulate_problem_from_natural_language(req: AIAnalyzeRequest):
    if not req.problem_description.strip():
        raise HTTPException(status_code=400, detail="Problem description cannot be empty.")
    try:
        return ai_assistant.analyze_problem_description(req.problem_description)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AI Formulation Error: {str(e)}")
