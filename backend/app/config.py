from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    openrouter_api_key: str
    langsmith_api_key: str = ""
    frontend_url: str = "http://localhost:5173"
    templates_dir: str = "../templates"
    classifier_model: str = "openai/gpt-4o-mini"
    narrative_model: str = "anthropic/claude-haiku-4-5"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
