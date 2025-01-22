import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Login from './Login'
import LandingPage from './LandingPage'
import { BrowserRouter, Route, Routes } from "react-router";
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
