
# Tri-Tender MCP (FastMCP + Real PDF Output)

This is a FastMCP-based Model Context Protocol server that exposes tools for the
Tri-Tender tender automation system: tender intake, compliance checklist, pricing,
evaluation, proposal assembly, and **real HTML → PDF rendering** via WeasyPrint.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

> Note: `weasyprint` requires system libraries like Cairo, Pango, and GDK-PixBuf.
> See the official WeasyPrint docs for installation instructions on your OS:
> https://weasyprint.readthedocs.io/

## Run the MCP server (stdio)

```bash
python server.py
```

Then configure Claude Desktop or any MCP-compatible client to use this server.
For remote HTTP usage, change `mcp.run()` at the bottom to:

```python
mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)
```

and deploy behind HTTPS.
