/**
 * Error Boundary Component
 * يعالج الأخطاء العامة في التطبيق
 */

import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border border-red-200">
            <div className="text-red-500 text-4xl font-black mb-4">⚠️</div>
            <h1 className="text-2xl font-black text-slate-900 mb-4">عذراً، حدث خطأ</h1>
            <p className="text-slate-600 mb-6 font-bold">
              {this.state.error?.message || 'حدث خطأ غير متوقع'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
