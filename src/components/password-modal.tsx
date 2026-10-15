"use client";

import { useState } from "react";
import { useTheme } from "@/contexts/theme-context";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => boolean;
  title?: string;
  message?: string;
}

export function PasswordModal({
  isOpen,
  onClose,
  onConfirm,
  title = "验证密码",
  message = "请输入密码以查看此文档"
}: PasswordModalProps) {
  const { mode } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (onConfirm(password)) {
      setError('');
      setPassword('');
      onClose();
    } else {
      setError('密码错误，请重试');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`p-6 rounded-lg max-w-sm w-full mx-4 ${
        mode === 'dark' ? 'bg-slate-800' : 'bg-white'
      }`}>
        <h3 className={`text-lg font-medium mb-4 ${
          mode === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </h3>
        <p className={`text-sm mb-4 ${
          mode === 'dark' ? 'text-gray-300' : 'text-gray-600'
        }`}>
          {message}
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 mb-2 ${
            mode === 'dark'
              ? 'bg-slate-700 border-slate-600 focus:ring-slate-500 text-white placeholder-gray-400'
              : 'bg-gray-100 border-gray-300 focus:ring-gray-400 text-gray-900 placeholder-gray-500'
          }`}
          autoFocus
          onKeyPress={handleKeyPress}
        />
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              onClose();
              setPassword('');
              setError('');
            }}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              mode === 'dark'
                ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              mode === 'dark'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}