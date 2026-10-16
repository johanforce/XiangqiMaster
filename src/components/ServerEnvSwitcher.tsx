import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Server, Check, ArrowRightLeft, ShieldCheck, FlaskConical, X, Info, Lock, Unlock } from 'lucide-react';
import { ServerEnv, SERVER_ENV_CONFIG, setServerEnv, isStagingUnlocked } from '../utils/serverEnv';
import { StagingPasswordModal } from './StagingPasswordModal';

interface ServerEnvSwitcherProps {
  currentEnv: ServerEnv;
  onEnvChange: (newEnv: ServerEnv) => void;
  compact?: boolean;
}

export const ServerEnvSwitcher: React.FC<ServerEnvSwitcherProps> = ({
  currentEnv,
  onEnvChange,
  compact = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const activeCfg = SERVER_ENV_CONFIG[currentEnv];
  const stagingUnlocked = isStagingUnlocked();

  const handleSelect = (env: ServerEnv) => {
    if (env === currentEnv) {
      setModalOpen(false);
      return;
    }

    if (env === 'staging' && !isStagingUnlocked()) {
      setPasswordModalOpen(true);
      return;
    }

    setServerEnv(env);
    onEnvChange(env);
    setModalOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
          activeCfg.badgeColor
        } ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5'}`}
        title={`Đang kết nối: ${activeCfg.fullName}. Bấm để chuyển đổi giữa Prod và Staging`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${activeCfg.indicatorColor}`} />
        <span className="font-mono-num tracking-wide">{activeCfg.label}</span>
        {currentEnv === 'staging' ? (
          <FlaskConical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
      </button>

      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn overflow-y-auto pointer-events-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-stone-100">
                    Chọn Máy Chủ Kết Nối
                  </h3>
                  <p className="text-xs text-stone-400">
                    Hệ thống 2 server độc lập hoàn toàn dữ liệu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông báo phân định */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Dữ liệu tài khoản, phòng chơi và Elo ở <strong>Staging</strong> được tách biệt 100% với <strong>Prod</strong>. Bạn có thể tự do test cờ, test tính năng mới ở Staging mà không lo ảnh hưởng dữ liệu thật.
              </div>
            </div>

            {/* Danh sách 2 Server */}
            <div className="space-y-3">
              {/* Option 1: PROD */}
              <div
                onClick={() => handleSelect('prod')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  currentEnv === 'prod'
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-stone-100">
                        Máy Chủ Production (Chính thức)
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono-num">
                        PROD
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Môi trường chính thức cho kỳ thủ thi đấu. Dữ liệu tài khoản, xếp hạng Elo, lịch sử đối đầu được lưu vĩnh viễn.
                    </p>
                  </div>
                </div>
                {currentEnv === 'prod' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Option 2: STAGING */}
              <div
                onClick={() => handleSelect('staging')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  currentEnv === 'staging'
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-stone-100">
                        Máy Chủ Staging (Thử nghiệm & Sandbox)
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono-num">
                        STAGING
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-stone-900 border-amber-500/30">
                        {stagingUnlocked ? (
                          <>
                            <Unlock className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300 font-semibold">Đã mở khóa</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-amber-400" />
                            <span className="text-amber-300">Cần mật khẩu</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Sandbox độc lập để lập trình viên và người dùng test game. Đăng ký tài khoản được duyệt ngay, có sẵn 2 tài khoản test nhanh (<code className="text-amber-300">kythu_test1</code>, <code className="text-amber-300">kythu_test2</code> / pass: <code className="text-amber-300">123</code>).
                    </p>
                  </div>
                </div>
                {currentEnv === 'staging' && (
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleSelect(currentEnv === 'prod' ? 'staging' : 'prod')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>
                  Chuyển sang {currentEnv === 'prod' ? 'Staging (Test)' : 'Production (Thật)'}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Staging Password Modal (Default: 123456) */}
      <StagingPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => {
          setServerEnv('staging');
          onEnvChange('staging');
          setModalOpen(false);
        }}
      />
    </>
  );
};
