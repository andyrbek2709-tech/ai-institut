# Calculations Platform - Deployment Guide

## Overview

The Calculations Platform consists of:
- **Backend**: FastAPI application (Python) running on port 8000
- **Frontend**: React + Vite application (TypeScript) running on port 3000/5173

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd ai-institut
   ```

2. **Setup Environment Variables**
   ```bash
   # Backend
   cp services/calculation-engine/.env.example services/calculation-engine/.env
   
   # Frontend
   cp apps/calculations-platform/.env.example apps/calculations-platform/.env
   ```

3. **Install Dependencies**

   **Backend:**
   ```bash
   cd services/calculation-engine
   pip install -e ".[dev]"
   ```

   **Frontend:**
   ```bash
   cd apps/calculations-platform
   npm install
   ```

### Running Locally

#### Option 1: Manual Startup

**Terminal 1 - Backend:**
```bash
cd services/calculation-engine
python app/main.py
```

**Terminal 2 - Frontend:**
```bash
cd apps/calculations-platform
npm run dev
```

Backend: http://localhost:8000
Frontend: http://localhost:5173
API Docs: http://localhost:8000/api/docs

#### Option 2: Docker Compose

```bash
docker-compose up
```

Backend: http://localhost:8000
Frontend: http://localhost:3000

## Testing

### Backend Tests
```bash
cd services/calculation-engine
pytest
pytest --cov=app tests/
```

### Frontend Tests
```bash
cd apps/calculations-platform
npm run test
npm run test:coverage
```

## Code Quality

### Backend
```bash
cd services/calculation-engine

# Linting
ruff check .

# Type checking
mypy app/

# Formatting
black app/
```

### Frontend
```bash
cd apps/calculations-platform

# Linting
npm run lint

# Formatting
npm run format

# Type checking
npm run type-check
```

## Railway Deployment

### Prerequisites
- Railway project already created
- Railway CLI installed: `npm i -g @railway/cli`
- GitHub repository connected

### Backend Deployment

1. **Configure Environment Variables in Railway**
   - `DEBUG=false`
   - `CORS_ORIGINS=https://your-frontend-domain.railway.app`
   - `DATABASE_URL=...` (if using PostgreSQL)
   - `LOG_LEVEL=INFO`

2. **Deploy**
   ```bash
   railway link
   railway up
   ```

3. **Verify**
   - Check Railway dashboard for deployment status
   - Visit health endpoint: `https://your-backend.railway.app/health`

### Frontend Deployment

1. **Configure Environment Variables in Railway**
   - `VITE_API_URL=https://your-backend.railway.app`

2. **Deploy**
   ```bash
   railway link
   railway up
   ```

3. **Verify**
   - Check Railway dashboard for deployment status
   - Visit frontend: `https://your-frontend.railway.app`

## Production Checklist

- [ ] Environment variables properly set in production
- [ ] CORS_ORIGINS configured for production domain
- [ ] API base URL correctly set in frontend
- [ ] Database connection verified (if using)
- [ ] Logging level set appropriately
- [ ] Health check endpoints responding
- [ ] All tests passing
- [ ] Code quality checks passing
- [ ] No console errors in frontend
- [ ] Database migrations applied (if needed)

## Troubleshooting

### Backend Issues

**Application won't start:**
- Check Python version: `python --version` (must be 3.11+)
- Check dependencies: `pip list`
- Check environment variables: `echo $DEBUG`
- View logs: `python -m uvicorn app.main:app --log-level debug`

**API returns 500 errors:**
- Check logs for detailed error messages
- Verify database connection (if using)
- Check that required environment variables are set

### Frontend Issues

**Cannot connect to API:**
- Check `VITE_API_URL` environment variable
- Verify backend is running and accessible
- Check browser console for CORS errors
- Verify backend CORS_ORIGINS configuration

**Build fails:**
- Clear `node_modules` and `dist`: `rm -rf node_modules dist`
- Reinstall: `npm install`
- Check for TypeScript errors: `npm run type-check`

## Monitoring

### Health Checks

**Backend:**
- Endpoint: `GET /health`
- Expected response: `{"status": "ok", "version": "0.1.0", "app": "Calculation Engine"}`

**Frontend:**
- Just load the application URL
- Check browser console for errors

### Logs

**Backend:**
- Check Railway application logs
- Format: JSON logs with timestamps
- Fields: `timestamp`, `level`, `logger`, `message`, `module`, `function`, `line`

**Frontend:**
- Browser console (F12)
- Network tab for API requests

## Updating

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Install new dependencies**
   ```bash
   # Backend
   cd services/calculation-engine && pip install -e ".[dev]"
   
   # Frontend
   cd apps/calculations-platform && npm install
   ```

3. **Run tests**
   ```bash
   # Backend
   cd services/calculation-engine && pytest
   
   # Frontend
   cd apps/calculations-platform && npm run test
   ```

4. **Deploy**
   - Push changes to main branch
   - Railway will automatically rebuild and deploy

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Review this guide's troubleshooting section
3. Check Railway dashboard for application status
4. Review the README files in each service directory
