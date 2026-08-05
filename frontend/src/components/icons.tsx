import type { ComponentType, SVGProps } from 'react';
import {
  AddPlus as CiAddPlus,
  Archive as CiArchive,
  ArrowDownMd as CiArrowDownMd,
  ArrowDownRightMd as CiArrowDownRightMd,
  ArrowDownUp as CiArrowDownUp,
  ArrowLeftMd as CiArrowLeftMd,
  ArrowLeftRight as CiArrowLeftRight,
  ArrowReload02 as CiArrowReload02,
  ArrowRightMd as CiArrowRightMd,
  ArrowSubDownLeft as CiArrowSubDownLeft,
  ArrowUpMd as CiArrowUpMd,
  ArrowUpRightMd as CiArrowUpRightMd,
  ArrowsReload01 as CiArrowsReload01,
  Bell as CiBell,
  BellRing as CiBellRing,
  BookOpen as CiBookOpen,
  Bookmark as CiBookmark,
  Building02 as CiBuilding02,
  Bulb as CiBulb,
  Calendar as CiCalendar,
  CalendarCheck as CiCalendarCheck,
  CalendarDays as CiCalendarDays,
  CalendarEvent as CiCalendarEvent,
  Camera as CiCamera,
  ChartBarVertical01 as CiChartBarVertical01,
  ChartLine as CiChartLine,
  ChartPie as CiChartPie,
  Chat as CiChat,
  ChatCircle as CiChatCircle,
  ChatConversation as CiChatConversation,
  ChatDots as CiChatDots,
  Check as CiCheck,
  ChevronDown as CiChevronDown,
  ChevronLeft as CiChevronLeft,
  ChevronRight as CiChevronRight,
  ChevronUp as CiChevronUp,
  CircleCheck as CiCircleCheck,
  CircleHelp as CiCircleHelp,
  CircleWarning as CiCircleWarning,
  Clock as CiClock,
  CloseCircle as CiCloseCircle,
  CloseMd as CiCloseMd,
  CloudUpload as CiCloudUpload,
  Columns as CiColumns,
  Compass as CiCompass,
  Copy as CiCopy,
  CreditCard01 as CiCreditCard01,
  CreditCard02 as CiCreditCard02,
  Cylinder as CiCylinder,
  Data as CiData,
  Download as CiDownload,
  DragVertical as CiDragVertical,
  EditPencil01 as CiEditPencil01,
  EditPencilLine01 as CiEditPencilLine01,
  Exit as CiExit,
  ExternalLink as CiExternalLink,
  FileDocument as CiFileDocument,
  Filter as CiFilter,
  Flag as CiFlag,
  Forward as CiForward,
  Gift as CiGift,
  Globe as CiGlobe,
  HamburgerMd as CiHamburgerMd,
  Headphones as CiHeadphones,
  Heart01 as CiHeart01,
  Help as CiHelp,
  Hide as CiHide,
  Info as CiInfo,
  Layer as CiLayer,
  Layers as CiLayers,
  Link as CiLink,
  LinkBreak as CiLinkBreak,
  LinkHorizontal as CiLinkHorizontal,
  ListCheck as CiListCheck,
  ListChecklist as CiListChecklist,
  ListUnordered as CiListUnordered,
  Loading as CiLoading,
  Lock as CiLock,
  LogOut as CiLogOut,
  Mail as CiMail,
  MailOpen as CiMailOpen,
  MapPin as CiMapPin,
  Mobile as CiMobile,
  MoreGridBig as CiMoreGridBig,
  MoreGridSmall as CiMoreGridSmall,
  MoreHorizontal as CiMoreHorizontal,
  MoreVertical as CiMoreVertical,
  Navigation as CiNavigation,
  Note as CiNote,
  PaperPlane as CiPaperPlane,
  Path as CiPath,
  Pause as CiPause,
  Phone as CiPhone,
  Play as CiPlay,
  Puzzle as CiPuzzle,
  QrCode as CiQrCode,
  RadioFill as CiRadioFill,
  Rainbow as CiRainbow,
  RemoveMinus as CiRemoveMinus,
  RemoveMinusCircle as CiRemoveMinusCircle,
  Save as CiSave,
  SearchMagnifyingGlass as CiSearchMagnifyingGlass,
  Settings as CiSettings,
  ShareAndroid as CiShareAndroid,
  Shield as CiShield,
  ShieldCheck as CiShieldCheck,
  Show as CiShow,
  Shuffle as CiShuffle,
  SkipForward as CiSkipForward,
  Slider01 as CiSlider01,
  Square as CiSquare,
  SquareCheck as CiSquareCheck,
  Star as CiStar,
  StopSign as CiStopSign,
  SwatchesPalette as CiSwatchesPalette,
  SwichtLeft as CiSwichtLeft,
  SwichtRight as CiSwichtRight,
  Tag as CiTag,
  TrashEmpty as CiTrashEmpty,
  TrendingDown as CiTrendingDown,
  TrendingUp as CiTrendingUp,
  TriangleWarning as CiTriangleWarning,
  User01 as CiUser01,
  UserAdd as CiUserAdd,
  UserCardId as CiUserCardId,
  UserCheck as CiUserCheck,
  UserCircle as CiUserCircle,
  UserClose as CiUserClose,
  UserVoice as CiUserVoice,
  Users as CiUsers,
  UsersGroup as CiUsersGroup,
  VolumeMax as CiVolumeMax,
  Wavy as CiWavy,
  WifiHigh as CiWifiHigh,
  WifiOff as CiWifiOff,
} from 'react-coolicons';

/* Iconographie du site et du produit : coolicons (react-coolicons, 442 icônes,
   licence MIT) sous une façade qui garde les noms et l'API de lucide, dont le
   projet se servait partout. Un appel existant comme <Phone size={13} /> n'a
   donc rien à changer : seul le chemin d'import bouge.

   Deux détails qui comptent :
   - coolicons dessine en 24x24 avec stroke="currentColor" et strokeWidth 2, et
     étale ses props APRÈS ses valeurs par défaut : couleur, épaisseur et taille
     restent donc pilotables depuis l'appelant, comme avant ;
   - certains glyphes de lucide n'existent pas dans coolicons (éclair, cerveau,
     fiole, robot). Le tableau ci-dessous prend à chaque fois le plus proche par
     le SENS de l'usage, pas par le nom. Le logo Qwillio n'est pas concerné :
     il reste QwillioLogo / qwillio-logo-512.svg. */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number;
}

export type LucideIcon = ComponentType<IconProps>;

function icon(Glyph: ComponentType<SVGProps<SVGSVGElement>>, name: string): LucideIcon {
  const Icon = ({ size = 24, ...rest }: IconProps) => (
    <Glyph width={size} height={size} {...rest} />
  );
  Icon.displayName = name;
  return Icon;
}

export const Activity = icon(CiChartLine, 'Activity');
export const AlertCircle = icon(CiCircleWarning, 'AlertCircle');
export const AlertTriangle = icon(CiTriangleWarning, 'AlertTriangle');
export const Apple = icon(CiMobile, 'Apple');
export const ArrowDown = icon(CiArrowDownMd, 'ArrowDown');
export const ArrowDownRight = icon(CiArrowDownRightMd, 'ArrowDownRight');
export const ArrowLeft = icon(CiArrowLeftMd, 'ArrowLeft');
export const ArrowLeftRight = icon(CiArrowLeftRight, 'ArrowLeftRight');
export const ArrowRight = icon(CiArrowRightMd, 'ArrowRight');
export const ArrowUp = icon(CiArrowUpMd, 'ArrowUp');
export const ArrowUpDown = icon(CiArrowDownUp, 'ArrowUpDown');
export const ArrowUpRight = icon(CiArrowUpRightMd, 'ArrowUpRight');
export const AudioLines = icon(CiWavy, 'AudioLines');
export const Ban = icon(CiStopSign, 'Ban');
export const BarChart3 = icon(CiChartBarVertical01, 'BarChart3');
export const Bell = icon(CiBell, 'Bell');
export const BookOpen = icon(CiBookOpen, 'BookOpen');
export const Bookmark = icon(CiBookmark, 'Bookmark');
export const Bot = icon(CiChatDots, 'Bot');
export const Brain = icon(CiBulb, 'Brain');
export const Bug = icon(CiPuzzle, 'Bug');
export const Building2 = icon(CiBuilding02, 'Building2');
export const Calculator = icon(CiMoreGridSmall, 'Calculator');
export const Calendar = icon(CiCalendar, 'Calendar');
export const CalendarCheck = icon(CiCalendarCheck, 'CalendarCheck');
export const CalendarClock = icon(CiCalendarEvent, 'CalendarClock');
export const CalendarDays = icon(CiCalendarDays, 'CalendarDays');
export const Camera = icon(CiCamera, 'Camera');
export const Check = icon(CiCheck, 'Check');
export const CheckCircle = icon(CiCircleCheck, 'CheckCircle');
export const CheckCircle2 = icon(CiCircleCheck, 'CheckCircle2');
export const CheckSquare = icon(CiSquareCheck, 'CheckSquare');
export const ChevronDown = icon(CiChevronDown, 'ChevronDown');
export const ChevronLeft = icon(CiChevronLeft, 'ChevronLeft');
export const ChevronRight = icon(CiChevronRight, 'ChevronRight');
export const ChevronUp = icon(CiChevronUp, 'ChevronUp');
export const Chrome = icon(CiGlobe, 'Chrome');
export const ClipboardCheck = icon(CiListCheck, 'ClipboardCheck');
export const ClipboardList = icon(CiListChecklist, 'ClipboardList');
export const Clock = icon(CiClock, 'Clock');
export const Clock3 = icon(CiClock, 'Clock3');
export const Columns3 = icon(CiColumns, 'Columns3');
export const Compass = icon(CiCompass, 'Compass');
export const Contact = icon(CiUserCardId, 'Contact');
export const Copy = icon(CiCopy, 'Copy');
export const CornerDownLeft = icon(CiArrowSubDownLeft, 'CornerDownLeft');
export const Cpu = icon(CiData, 'Cpu');
export const CreditCard = icon(CiCreditCard01, 'CreditCard');
export const Crosshair = icon(CiNavigation, 'Crosshair');
export const Database = icon(CiCylinder, 'Database');
export const DollarSign = icon(CiCreditCard02, 'DollarSign');
export const Download = icon(CiDownload, 'Download');
export const Edit2 = icon(CiEditPencil01, 'Edit2');
export const Edit3 = icon(CiEditPencilLine01, 'Edit3');
export const ExternalLink = icon(CiExternalLink, 'ExternalLink');
export const Eye = icon(CiShow, 'Eye');
export const EyeOff = icon(CiHide, 'EyeOff');
export const FileText = icon(CiFileDocument, 'FileText');
export const Filter = icon(CiFilter, 'Filter');
export const Flame = icon(CiTrendingUp, 'Flame');
export const FlaskConical = icon(CiCylinder, 'FlaskConical');
export const Gift = icon(CiGift, 'Gift');
export const GitBranch = icon(CiPath, 'GitBranch');
export const GitMerge = icon(CiShuffle, 'GitMerge');
export const Globe = icon(CiGlobe, 'Globe');
export const GripVertical = icon(CiDragVertical, 'GripVertical');
export const Handshake = icon(CiUsersGroup, 'Handshake');
export const Headphones = icon(CiHeadphones, 'Headphones');
export const Heart = icon(CiHeart01, 'Heart');
export const HelpCircle = icon(CiCircleHelp, 'HelpCircle');
export const Inbox = icon(CiArchive, 'Inbox');
export const Info = icon(CiInfo, 'Info');
export const Key = icon(CiLock, 'Key');
export const KeyRound = icon(CiLock, 'KeyRound');
export const Languages = icon(CiGlobe, 'Languages');
export const Layers = icon(CiLayers, 'Layers');
export const LayoutDashboard = icon(CiMoreGridBig, 'LayoutDashboard');
export const LifeBuoy = icon(CiHelp, 'LifeBuoy');
export const Lightbulb = icon(CiBulb, 'Lightbulb');
export const LineChart = icon(CiChartLine, 'LineChart');
export const Link2 = icon(CiLink, 'Link2');
export const List = icon(CiListUnordered, 'List');
export const ListChecks = icon(CiListCheck, 'ListChecks');
export const Loader2 = icon(CiLoading, 'Loader2');
export const Lock = icon(CiLock, 'Lock');
export const LogOut = icon(CiLogOut, 'LogOut');
export const Mail = icon(CiMail, 'Mail');
export const MailCheck = icon(CiMailOpen, 'MailCheck');
export const MapPin = icon(CiMapPin, 'MapPin');
export const Megaphone = icon(CiBellRing, 'Megaphone');
export const Menu = icon(CiHamburgerMd, 'Menu');
export const MessageCircle = icon(CiChatCircle, 'MessageCircle');
export const MessageSquare = icon(CiChat, 'MessageSquare');
export const MessagesSquare = icon(CiChatConversation, 'MessagesSquare');
export const Mic = icon(CiUserVoice, 'Mic');
export const Mic2 = icon(CiUserVoice, 'Mic2');
export const Minus = icon(CiRemoveMinus, 'Minus');
export const MinusCircle = icon(CiRemoveMinusCircle, 'MinusCircle');
export const MoreHorizontal = icon(CiMoreHorizontal, 'MoreHorizontal');
export const MoreVertical = icon(CiMoreVertical, 'MoreVertical');
export const Newspaper = icon(CiNote, 'Newspaper');
export const Package = icon(CiLayer, 'Package');
export const Palette = icon(CiSwatchesPalette, 'Palette');
export const PartyPopper = icon(CiRainbow, 'PartyPopper');
export const Pause = icon(CiPause, 'Pause');
export const Pencil = icon(CiEditPencil01, 'Pencil');
export const Percent = icon(CiChartPie, 'Percent');
export const Phone = icon(CiPhone, 'Phone');
export const PhoneCall = icon(CiPhone, 'PhoneCall');
export const PhoneForwarded = icon(CiForward, 'PhoneForwarded');
export const PhoneOff = icon(CiCloseCircle, 'PhoneOff');
export const Play = icon(CiPlay, 'Play');
export const Plug = icon(CiLink, 'Plug');
export const Plus = icon(CiAddPlus, 'Plus');
export const Power = icon(CiExit, 'Power');
export const QrCode = icon(CiQrCode, 'QrCode');
export const Radio = icon(CiRadioFill, 'Radio');
export const Receipt = icon(CiFileDocument, 'Receipt');
export const RefreshCw = icon(CiArrowsReload01, 'RefreshCw');
export const Rocket = icon(CiPaperPlane, 'Rocket');
export const RotateCcw = icon(CiArrowReload02, 'RotateCcw');
export const RotateCw = icon(CiArrowsReload01, 'RotateCw');
export const Save = icon(CiSave, 'Save');
export const ScrollText = icon(CiFileDocument, 'ScrollText');
export const Search = icon(CiSearchMagnifyingGlass, 'Search');
export const Send = icon(CiPaperPlane, 'Send');
export const Server = icon(CiCylinder, 'Server');
export const Settings = icon(CiSettings, 'Settings');
export const Share2 = icon(CiShareAndroid, 'Share2');
export const Shield = icon(CiShield, 'Shield');
export const ShieldCheck = icon(CiShieldCheck, 'ShieldCheck');
export const SkipForward = icon(CiSkipForward, 'SkipForward');
export const SlidersHorizontal = icon(CiSlider01, 'SlidersHorizontal');
export const Smartphone = icon(CiMobile, 'Smartphone');
export const Sparkles = icon(CiStar, 'Sparkles');
export const Square = icon(CiSquare, 'Square');
export const Star = icon(CiStar, 'Star');
export const StickyNote = icon(CiNote, 'StickyNote');
export const Tag = icon(CiTag, 'Tag');
export const Target = icon(CiFlag, 'Target');
export const TestTube = icon(CiCylinder, 'TestTube');
export const ToggleLeft = icon(CiSwichtLeft, 'ToggleLeft');
export const ToggleRight = icon(CiSwichtRight, 'ToggleRight');
export const Trash2 = icon(CiTrashEmpty, 'Trash2');
export const TrendingDown = icon(CiTrendingDown, 'TrendingDown');
export const TrendingUp = icon(CiTrendingUp, 'TrendingUp');
export const Unlink = icon(CiLinkBreak, 'Unlink');
export const Upload = icon(CiCloudUpload, 'Upload');
export const User = icon(CiUser01, 'User');
export const UserCheck = icon(CiUserCheck, 'UserCheck');
export const UserCircle = icon(CiUserCircle, 'UserCircle');
export const UserPlus = icon(CiUserAdd, 'UserPlus');
export const UserX = icon(CiUserClose, 'UserX');
export const Users = icon(CiUsers, 'Users');
export const Volume2 = icon(CiVolumeMax, 'Volume2');
export const Wallet = icon(CiCreditCard01, 'Wallet');
export const Webhook = icon(CiLinkHorizontal, 'Webhook');
export const Wifi = icon(CiWifiHigh, 'Wifi');
export const WifiOff = icon(CiWifiOff, 'WifiOff');
export const X = icon(CiCloseMd, 'X');
export const XCircle = icon(CiCloseCircle, 'XCircle');
export const Zap = icon(CiBulb, 'Zap');
