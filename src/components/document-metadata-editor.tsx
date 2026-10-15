"use client";

import { useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Eye, EyeOff, X, SlidersHorizontal } from "lucide-react";

interface DocumentMetadataEditorProps {
  frontMatter: any;
  onChange: (frontMatter: any) => void;
}

export function DocumentMetadataEditor({ frontMatter, onChange }: DocumentMetadataEditorProps) {
  const { mode } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const handleChange = (field: string, value: any) => {
    onChange({
      ...frontMatter,
      [field]: value,
    });
  };

  return (
    <div className="tech-metadata p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`flex items-center gap-2 text-sm font-medium ${
          mode === 'dark' ? 'text-gray-200' : 'text-gray-800'
        }`}>
          <SlidersHorizontal size={14} strokeWidth={1.75} /> 文档属性
        </h3>
      </div>

      <div className="space-y-4">
        {/* 高级字段 */}
        {(
          <>
            <div>
              <label className={`block text-xs font-medium mb-1 ${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                封面图
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={frontMatter.coverImage || ''}
                  onChange={(e) => handleChange('coverImage', e.target.value)}
                  placeholder="封面图 URL"
                  className={`flex-1 px-3 py-2 text-sm rounded border focus:outline-none focus:ring-1 ${
                    mode === 'dark'
                      ? 'bg-slate-700 border-slate-600 focus:ring-slate-500 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 focus:ring-gray-400 text-gray-900 placeholder-gray-500'
                  }`}
                />
                {frontMatter.coverImage && (
                  <button
                    onClick={() => handleChange('coverImage', '')}
                    className="tech-icon-button h-9 w-9"
                    title="删除封面图"
                    aria-label="删除封面图"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              {frontMatter.coverImage && (
                <div className="mt-2">
                  <img
                    src={frontMatter.coverImage}
                    alt="封面图预览"
                    className="w-full h-32 object-cover rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                作者
              </label>
              <input
                type="text"
                value={frontMatter.author || ''}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder="作者名称"
                className={`w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-1 ${
                  mode === 'dark'
                    ? 'bg-slate-700 border-slate-600 focus:ring-slate-500 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 focus:ring-gray-400 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                标签 (用逗号分隔)
              </label>
              <input
                type="text"
                value={frontMatter.tags ? frontMatter.tags.join(', ') : ''}
                onChange={(e) => handleChange('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                placeholder="React, TypeScript, 前端"
                className={`w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-1 ${
                  mode === 'dark'
                    ? 'bg-slate-700 border-slate-600 focus:ring-slate-500 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 focus:ring-gray-400 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                摘要
              </label>
              <textarea
                value={frontMatter.excerpt || ''}
                onChange={(e) => handleChange('excerpt', e.target.value)}
                placeholder="文档摘要..."
                rows={3}
                className={`w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-1 resize-none ${
                  mode === 'dark'
                    ? 'bg-slate-700 border-slate-600 focus:ring-slate-500 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 focus:ring-gray-400 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${
                mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                访问密码
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={frontMatter.password || ''}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="留空则无需密码"
                    className={`w-full px-3 py-2 pr-8 text-sm rounded border focus:outline-none focus:ring-1 ${
                      mode === 'dark'
                        ? 'bg-slate-700 border-slate-600 focus:ring-slate-500 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 focus:ring-gray-400 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  {frontMatter.password && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-1 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors ${
                        mode === 'dark'
                          ? 'text-gray-400 hover:text-gray-300'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title={showPassword ? "隐藏密码" : "显示密码"}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                    </button>
                  )}
                </div>
                {frontMatter.password && (
                  <button
                    onClick={() => handleChange('password', '')}
                    className="tech-icon-button h-9 w-9"
                    title="删除密码"
                    aria-label="删除密码"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <p className={`text-xs mt-1 ${
                mode === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                设置密码后，查看此文档需要输入密码
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
