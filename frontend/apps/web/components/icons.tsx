// Ícones Lucide (0.460.0, fixado como no DESIGN_SYSTEM.md §7), sempre decorativos (aria-hidden): o sentido vem do
// texto ao lado. "Um ícone, um significado":
//   feeds e tipo de conteúdo → users (Perfis), file-text (Posts/texto), mic (Áudio), triangle-alert (Alertas e
//   severidade), image (foto), video (vídeo), briefcase (vaga)
//   ações do card → heart (curtir), message-circle (comentar), share-2 (compartilhar), bookmark (salvar)
//   tendência → flame (em alta), trending-up, minus (estável), trending-down — indicador, nunca botão
//   selo VERIFIED → badge-check · fonte oficial verificada → shield-check · erro de formulário → circle-alert
//   Configurações: settings, user-pen (perfil), palette (exibição), shield (privacidade), key-round (segurança),
//   lock (travado), clock (prazo/validade), copy, download, image-up (enviar foto), monitor e smartphone
//   (aparelho da sessão), user-x (excluir conta).
//   Outros, um sentido cada: search, map-pin, locate-fixed, sun, moon, log-in, log-out, circle-user,
//   circle-check, info, pencil, trash-2, chevron-left, chevron-right, mail, x, send, archive, archive-restore,
//   square-plus (Publicar), eye-off (perfil privado), external-link, link, play, pause, sparkles (Background
//   Studio), sliders-horizontal (filtros), calendar (membro desde), hourglass (em breve).
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleUser,
  Clock,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  Flame,
  Heart,
  Hourglass,
  Image as ImageIcon,
  ImageUp,
  Info,
  KeyRound,
  Link as LinkIcon,
  LocateFixed,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Monitor,
  Moon,
  Palette,
  Pause,
  Pencil,
  Play,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SquarePlus,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserPen,
  UserX,
  Users,
  Video,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

function decorative(Icon: LucideIcon) {
  function DecorativeIcon(props: LucideProps) {
    return <Icon aria-hidden="true" focusable="false" {...props} />;
  }
  DecorativeIcon.displayName = Icon.displayName;
  return DecorativeIcon;
}

export type DecorativeIcon = ReturnType<typeof decorative>;

export const IconVerified = decorative(BadgeCheck);
export const IconFormError = decorative(CircleAlert);
export const IconSuccess = decorative(CircleCheck);
export const IconInfo = decorative(Info);
export const IconSearch = decorative(Search);
export const IconPlace = decorative(MapPin);
export const IconNearMe = decorative(LocateFixed);
export const IconThemeLight = decorative(Sun);
export const IconThemeDark = decorative(Moon);
export const IconLogin = decorative(LogIn);
export const IconLogout = decorative(LogOut);
export const IconAccount = decorative(CircleUser);
export const IconEdit = decorative(Pencil);
export const IconDelete = decorative(Trash2);
export const IconPrev = decorative(ChevronLeft);
export const IconNext = decorative(ChevronRight);
export const IconEmail = decorative(Mail);
export const IconClose = decorative(X);
export const IconSettings = decorative(Settings);
export const IconProfileEdit = decorative(UserPen);
export const IconDisplay = decorative(Palette);
export const IconPrivacy = decorative(Shield);
export const IconMfaOn = decorative(ShieldCheck);
export const IconSecurity = decorative(KeyRound);
export const IconLocked = decorative(Lock);
export const IconDeadline = decorative(Clock);
export const IconCopy = decorative(Copy);
export const IconDownload = decorative(Download);
export const IconPhotoUpload = decorative(ImageUp);
export const IconDesktop = decorative(Monitor);
export const IconPhone = decorative(Smartphone);
export const IconDeleteAccount = decorative(UserX);

export const IconLike = decorative(Heart);
export const IconComment = decorative(MessageCircle);
export const IconShare = decorative(Share2);
export const IconSave = decorative(Bookmark);
export const IconSend = decorative(Send);
export const IconArchive = decorative(Archive);
export const IconRestore = decorative(ArchiveRestore);
export const IconPublish = decorative(SquarePlus);
export const IconPrivate = decorative(EyeOff);
export const IconExternal = decorative(ExternalLink);
export const IconLink = decorative(LinkIcon);
export const IconAlert = decorative(TriangleAlert);
export const IconOfficialSource = decorative(ShieldCheck);
export const IconPlay = decorative(Play);
export const IconPause = decorative(Pause);
export const IconStudio = decorative(Sparkles);
export const IconFilters = decorative(SlidersHorizontal);
export const IconMemberSince = decorative(Calendar);
export const IconSoon = decorative(Hourglass);

// feeds do Segmented Switcher (OS-31)
export const IconFeedProfiles = decorative(Users);
export const IconFeedPosts = decorative(FileText);
export const IconFeedAudio = decorative(Mic);
export const IconFeedAlerts = decorative(TriangleAlert);

/** Tipo de mídia do post: ícone + texto (nunca só o ícone). */
export const MEDIA_ICONS: Record<string, DecorativeIcon> = {
  TEXT: decorative(FileText),
  IMAGE: decorative(ImageIcon),
  VIDEO: decorative(Video),
  AUDIO: decorative(Mic),
};

export const IconJob = decorative(Briefcase);

/** Tendência (OS-36): ícone + texto, discreto, nunca compete com o título. */
export const TRENDING_ICONS: Record<string, DecorativeIcon> = {
  HOT: decorative(Flame),
  RISING: decorative(TrendingUp),
  STABLE: decorative(Minus),
  FALLING: decorative(TrendingDown),
};
