# Doraemon

Doraemon is a project that combines backend and frontend components to provide a comprehensive solution for various tasks.

## Features

- **Backend**: Built with Python, providing APIs and services.
- **Frontend**: Built with React and Electron, offering a user-friendly interface.

## Installation

### Prerequisites

- Python 3.8+
- Node.js 16+
- Git

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up the environment variables by copying the example file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file to include your specific configurations.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the required Node.js packages:
   ```bash
   npm install
   ```

## Running the Application

### Backend

To start the backend server:
```bash
cd backend
python main.py
```

### Frontend

To start the frontend application:
```bash
cd frontend
npm run dev
```

## Building the Application

### Frontend

To build the frontend for production:
```bash
cd frontend
npm run build
```

## Project Structure

- `backend/`: Contains all backend-related code and configurations.
- `frontend/`: Contains all frontend-related code and configurations.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
