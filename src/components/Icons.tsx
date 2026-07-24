// Tiny inline icon set — lucide-style paths — keeps the app dep-lean.

type P = { size?: number };
const S = ({ children, size = 16 }: { children: any; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconHome = ({ size }: P) => <S size={size}><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V10.5z" /></S>;
export const IconUsers = ({ size }: P) => <S size={size}><circle cx="9" cy="8" r="3" /><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" /><circle cx="17" cy="7" r="2.5" /><path d="M22 20c0-2.8-2-5-4.5-5.4" /></S>;
export const IconBook = ({ size }: P) => <S size={size}><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" /><path d="M18 4v13a3 3 0 0 1-3 3" /></S>;
export const IconCash = ({ size }: P) => <S size={size}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 10v.01M18 14v.01" /></S>;
export const IconBell = ({ size }: P) => <S size={size}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" /><path d="M10 21a2 2 0 0 0 4 0" /></S>;
export const IconCalendar = ({ size }: P) => <S size={size}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></S>;
export const IconClipboard = ({ size }: P) => <S size={size}><rect x="7" y="3" width="10" height="4" rx="1" /><path d="M5 7h14v14H5z" /></S>;
export const IconGrad = ({ size }: P) => <S size={size}><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" /></S>;
export const IconBus = ({ size }: P) => <S size={size}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 12h18M7 18v2M17 18v2" /><circle cx="8" cy="15" r="1" /><circle cx="16" cy="15" r="1" /></S>;
export const IconChart = ({ size }: P) => <S size={size}><path d="M3 21V3M3 15l5-5 4 4 8-8" /></S>;
export const IconLibrary = ({ size }: P) => <S size={size}><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l4 1-3 14-4-1z" /></S>;
export const IconShield = ({ size }: P) => <S size={size}><path d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z" /></S>;
export const IconFace = ({ size }: P) => <S size={size}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /><path d="M9 15c.8.7 1.9 1 3 1s2.2-.3 3-1" /></S>;
export const IconTruck = ({ size }: P) => <S size={size}><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" /><circle cx="7" cy="17" r="1.5" /><circle cx="17" cy="17" r="1.5" /></S>;
export const IconLead = ({ size }: P) => <S size={size}><path d="M12 2l3 6 6 .8-4.5 4.2 1.2 6.5L12 16l-5.7 3.5L7.5 13 3 8.8 9 8z" /></S>;
export const IconLMS = ({ size }: P) => <S size={size}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M3 20h18" /><path d="M10 8l4 3-4 3z" fill="currentColor" stroke="none" /></S>;
export const IconExam = ({ size }: P) => <S size={size}><path d="M4 4h11l5 5v11H4z" /><path d="M7 12h10M7 16h6" /></S>;
export const IconBuilding = ({ size }: P) => <S size={size}><rect x="4" y="3" width="16" height="18" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></S>;
export const IconGear = ({ size }: P) => <S size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>;
export const IconMega = ({ size }: P) => <S size={size}><path d="M3 11v2l14 5V6zM19 10v4M7 13l.5 6h3l-.5-6" /></S>;
export const IconFlask = ({ size }: P) => <S size={size}><path d="M9 3h6M10 3v6l-6 12h16L14 9V3" /></S>;
export const IconMoney = ({ size }: P) => <S size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10c0-1.5 1.5-2 3-2s3 .5 3 2-1.5 2-3 2-3 .5-3 2 1.5 2 3 2 3-.5 3-2" /></S>;
export const IconLog = ({ size }: P) => <S size={size}><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></S>;
export const IconWorkflow = ({ size }: P) => <S size={size}><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><path d="M9 6h6M18 9v6M15 18H9v-6" /></S>;
