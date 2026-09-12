import React from 'react';
import { Shield, Sparkles, FolderLock, FileCheck, Trash2, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onSignIn: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn, isLoading, error }) => {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="max-w-md w-full bg-[#181818] border border-[#2c2c2c] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Badge & Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#C75B12]/20 to-[#C9A86A]/20 border border-[#C75B12]/40 flex items-center justify-center text-[#C75B12] shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#F5E9DC] tracking-tight">
              Drive Cleanup Agent
            </h2>
            <p className="text-xs text-[#C9A86A] font-semibold mt-1 uppercase tracking-wider">
              Document Processor &bull; TEST First Run
            </p>
          </div>
        </div>

        {/* Core Rules Brief */}
        <div className="bg-[#121212] border border-[#242424] rounded-2xl p-4 text-left space-y-2.5 text-xs text-[#D8D0C5]">
          <div className="flex items-start gap-2.5">
            <FolderLock className="w-4 h-4 text-[#C75B12] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#F5E9DC]">Folder &ldquo;Craft&rdquo; Excluded:</strong>
              <p className="text-[#888888]">Skipped completely. Contents are never read or referenced.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#F5E9DC]">&ldquo;00_README.txt&rdquo; Protected:</strong>
              <p className="text-[#888888]">Answer key is strictly untouched and not read.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Trash2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#F5E9DC]">Safe Drive Trash:</strong>
              <p className="text-[#888888]">Older duplicates moved to Drive Trash (not permanently deleted).</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <FileCheck className="w-4 h-4 text-[#C9A86A] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#F5E9DC]">First Run Scope:</strong>
              <p className="text-[#888888]">Only processes &ldquo;TEST&rdquo; folder, then pauses for confirmation.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs text-left">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Official Google Sign-in Button */}
        <div className="pt-2 flex flex-col items-center">
          <button
            id="google-signin-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="gsi-material-button w-full flex items-center justify-center cursor-pointer min-h-[48px]"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper flex items-center justify-center gap-3">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block', width: '20px', height: '20px' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-semibold text-xs text-[#1f1f1f]">
                {isLoading ? 'Connecting to Drive...' : 'Sign in with Google'}
              </span>
            </div>
          </button>

          <p className="text-[11px] text-[#777777] mt-3">
            Requires Google Drive access to inspect and clean up duplicate documents.
          </p>
        </div>
      </div>
    </div>
  );
};
