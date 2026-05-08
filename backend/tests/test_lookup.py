import pytest

from app.strategies.lookup import execute_lookup

SOURCES = {
    "risk_disclosure_clause": "Risk assessed per ISO 31000.",
    "qualification_scope_statements": {
        "Precision machined components": "Scope text for precision components.",
        "Logistics services": "Scope text for logistics.",
    },
    "signatory_block": "Prepared by: {{evaluator_name}} · {{issue_date}}",
}


def test_plain_lookup():
    result = execute_lookup("risk_disclosure_clause", SOURCES, {})
    assert result == "Risk assessed per ISO 31000."


def test_dict_key_lookup():
    ctx = {"commodity_category": "Precision machined components"}
    result = execute_lookup("qualification_scope_statements[commodity_category]", SOURCES, ctx)
    assert result == "Scope text for precision components."


def test_dict_key_lookup_second_value():
    ctx = {"commodity_category": "Logistics services"}
    result = execute_lookup("qualification_scope_statements[commodity_category]", SOURCES, ctx)
    assert result == "Scope text for logistics."


def test_interpolation():
    ctx = {"evaluator_name": "Jane Smith", "issue_date": "2026-05-08"}
    result = execute_lookup("signatory_block", SOURCES, ctx)
    assert "Jane Smith" in result
    assert "2026-05-08" in result


def test_interpolation_dot_notation():
    sources = {"footer": "Version: {{template.version}}"}
    ctx = {"template": {"version": "1.0"}}
    result = execute_lookup("footer", sources, ctx)
    assert result == "Version: 1.0"


def test_key_not_found():
    with pytest.raises(LookupError, match="nonexistent"):
        execute_lookup("nonexistent", SOURCES, {})


def test_dict_key_index_not_found():
    ctx = {"commodity_category": "Unknown commodity"}
    with pytest.raises(LookupError):
        execute_lookup("qualification_scope_statements[commodity_category]", SOURCES, ctx)


def test_context_key_none():
    ctx = {"commodity_category": None}
    with pytest.raises(LookupError):
        execute_lookup("qualification_scope_statements[commodity_category]", SOURCES, ctx)
