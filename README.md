# Credit Card Payment System

## Project Overview

A full-stack Credit Card Payment System built using React, Django REST Framework, FastAPI, MySQL, Tailwind CSS, and Docker.

## Features

- User registration and login
- JWT authentication
- Protected routes
- Credit card management
- Card masking
- Payment processing
- Transaction history
- Transaction filtering
- Admin dashboard
- Django admin panel
- MySQL database
- REST APIs
- Docker containerization
- Postman API testing

## Technologies

- React
- Vite
- Tailwind CSS
- Python
- Django
- Django REST Framework
- FastAPI
- MySQL
- Docker
- Docker Compose
- Postman
- Git

## Project Structure

CreditCardPaymentSystem/
- backend/
- frontend/
- docs/
- postman/
- docker-compose.yml
- .gitignore
- README.md

## Docker Services

- React Frontend
- Django Backend
- FastAPI Payment API
- MySQL Database

## Run the Project

### Start Docker

docker compose up -d

### Check containers

docker compose ps

## Application URLs

Frontend:
http://127.0.0.1:5173

Django:
http://127.0.0.1:8000

FastAPI:
http://127.0.0.1:8001

Django Admin:
http://127.0.0.1:8000/admin/

## Database

Database name:

credit_card_db

Main application tables:

- users_user
- cards_card
- transactions_transaction

## API Documentation

API documentation:

docs/API.md

Postman collection:

docs/postman/CreditCardPaymentSystem.postman_collection.json

## Testing

Django tests and payment API tests are included in the project.

Latest verified results:

- Django tests: 25 tests passed
- Payment API tests: 10 tests passed
- Django coverage: 95%
- Payment API coverage: 78%

## Security

- Passwords are stored using Django password hashing.
- JWT authentication protects restricted APIs.
- Protected routes require authentication.
- Users can access only their own cards and transactions.
- CVV is not stored.
- Card numbers are masked.
- Production-sensitive configuration uses environment variables.
- Environment files are excluded from Git.
- SQLite database files are excluded from Git.

## Environment Configuration

Production configuration template:

backend/django_backend/.env.production.example

Production deployment should use secure secrets, database credentials, allowed hosts, CORS configuration, DJANGO_DEBUG=False, and HTTPS.

## Git

Initial Git commit:

Initial commit - Credit Card Payment System

## Notes

The project is currently configured for local development and testing with Docker.
