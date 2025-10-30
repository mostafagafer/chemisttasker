import * as React from "react";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Popover from "@mui/material/Popover";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useNavigate } from "react-router-dom";
import { useColorMode } from "../theme/sleekTheme";
import { useAuth } from "../contexts/AuthContext";
import { fetchNotifications, markNotificationsRead, NotificationItem } from "../api/notifications";
import { API_BASE_URL, API_ENDPOINTS } from "../constants/api";
import apiClient from "../utils/apiClient";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

type SearchOption = {
  label: string;
  path: string;
  keywords?: string[];
  description?: string;
};

const ownerOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/owner/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Manage Pharmacies",
      path: "/dashboard/owner/manage-pharmacies",
      keywords: ["pharmacies", "stores", "management"],
      description: "Browse and edit your pharmacy locations",
    },
    {
      label: "My Pharmacies",
      path: "/dashboard/owner/manage-pharmacies/my-pharmacies",
      keywords: ["locations", "branches", "pharmacy list"],
    },
    {
      label: "My Chain",
      path: "/dashboard/owner/manage-pharmacies/my-chain",
      keywords: ["chain", "group", "network"],
    },
    {
      label: "Internal Roster",
      path: "/dashboard/owner/manage-pharmacies/roster",
      keywords: ["schedule", "roster", "staffing"],
    },
    {
      label: "Post a Shift",
      path: "/dashboard/owner/post-shift",
      keywords: ["create shift", "new shift", "shift posting"],
    },
    {
      label: "Public Shifts",
      path: "/dashboard/owner/shifts/public",
      keywords: ["public shifts", "available shifts"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/owner/shifts/community",
      keywords: ["community", "shared shifts"],
    },
    {
      label: "Active Shifts",
      path: "/dashboard/owner/shifts/active",
      keywords: ["active shifts", "current shifts"],
    },
    {
      label: "Confirmed Shifts",
      path: "/dashboard/owner/shifts/confirmed",
      keywords: ["confirmed", "booked shifts"],
    },
    {
      label: "Shift History",
      path: "/dashboard/owner/shifts/history",
      keywords: ["past shifts", "history"],
    },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/owner/onboarding",
      keywords: ["profile", "onboarding", "setup"],
    },
    {
      label: "Chat",
      path: "/dashboard/owner/chat",
      keywords: ["messages", "inbox", "communication"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/owner/interests",
      keywords: ["interests", "explore", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/owner/learning",
      keywords: ["learning", "training", "education"],
    },
    {
      label: "Logout",
      path: "/dashboard/owner/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const organizationOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/organization/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Invite Staff",
      path: "/dashboard/organization/invite",
      keywords: ["invite", "staff", "team"],
    },
    {
      label: "Claim Pharmacies",
      path: "/dashboard/organization/claim",
      keywords: ["claim", "pharmacies", "organization"],
    },
    {
      label: "Manage Pharmacies",
      path: "/dashboard/organization/manage-pharmacies",
      keywords: ["manage", "pharmacies", "stores"],
    },
    {
      label: "My Pharmacies",
      path: "/dashboard/organization/manage-pharmacies/my-pharmacies",
      keywords: ["locations", "branches", "pharmacy list"],
    },
    {
      label: "My Chain",
      path: "/dashboard/organization/manage-pharmacies/my-chain",
      keywords: ["chain", "group", "network"],
    },
    {
      label: "Internal Roster",
      path: "/dashboard/organization/manage-pharmacies/roster",
      keywords: ["roster", "schedule", "staffing"],
    },
    {
      label: "Post a Shift",
      path: "/dashboard/organization/post-shift",
      keywords: ["create shift", "new shift"],
    },
    {
      label: "Public Shifts",
      path: "/dashboard/organization/shifts/public",
      keywords: ["public shifts", "availability"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/organization/shifts/community",
      keywords: ["community", "shared"],
    },
    {
      label: "Active Shifts",
      path: "/dashboard/organization/shifts/active",
      keywords: ["active shifts", "current"],
    },
    {
      label: "Confirmed Shifts",
      path: "/dashboard/organization/shifts/confirmed",
      keywords: ["confirmed", "booked"],
    },
    {
      label: "Shift History",
      path: "/dashboard/organization/shifts/history",
      keywords: ["history", "past shifts"],
    },
    {
      label: "Chat",
      path: "/dashboard/organization/chat",
      keywords: ["messages", "inbox"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/organization/interests",
      keywords: ["interests", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/organization/learning",
      keywords: ["learning", "training"],
    },
    {
      label: "Logout",
      path: "/dashboard/organization/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const pharmacistOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/pharmacist/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Public Shifts",
      path: "/dashboard/pharmacist/shifts/public",
      keywords: ["public shifts", "available shifts"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/pharmacist/shifts/community",
      keywords: ["community", "platform shifts"],
    },
    {
      label: "My Confirmed Shifts",
      path: "/dashboard/pharmacist/shifts/confirmed",
      keywords: ["confirmed", "booked shifts"],
    },
    {
      label: "My Shift History",
      path: "/dashboard/pharmacist/shifts/history",
      keywords: ["past shifts", "history"],
    },
    {
      label: "My Roster",
      path: "/dashboard/pharmacist/shifts/roster",
      keywords: ["roster", "schedule", "internal"],
    },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/pharmacist/onboarding-v2",
      keywords: ["profile", "onboarding", "setup"],
    },
    {
      label: "Set Availability",
      path: "/dashboard/pharmacist/availability",
      keywords: ["availability", "calendar", "schedule"],
    },
    {
      label: "Invoices",
      path: "/dashboard/pharmacist/invoice",
      keywords: ["invoice", "billing", "payments"],
    },
    {
      label: "Create Invoice",
      path: "/dashboard/pharmacist/invoice/new",
      keywords: ["invoice", "new invoice", "billing"],
    },
    {
      label: "Chat",
      path: "/dashboard/pharmacist/chat",
      keywords: ["messages", "inbox", "communication"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/pharmacist/interests",
      keywords: ["interests", "explore", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/pharmacist/learning",
      keywords: ["learning", "training", "education"],
    },
    {
      label: "Logout",
      path: "/dashboard/pharmacist/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const otherStaffOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/otherstaff/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Public Shifts",
      path: "/dashboard/otherstaff/shifts/public",
      keywords: ["public shifts", "available"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/otherstaff/shifts/community",
      keywords: ["community", "platform shifts"],
    },
    {
      label: "My Confirmed Shifts",
      path: "/dashboard/otherstaff/shifts/confirmed",
      keywords: ["confirmed", "booked shifts"],
    },
    {
      label: "My Shift History",
      path: "/dashboard/otherstaff/shifts/history",
      keywords: ["past shifts", "history"],
    },
    {
      label: "My Roster",
      path: "/dashboard/otherstaff/shifts/roster",
      keywords: ["roster", "schedule"],
    },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/otherstaff/onboarding-v2",
      keywords: ["profile", "onboarding"],
    },
    {
      label: "Set Availability",
      path: "/dashboard/otherstaff/availability",
      keywords: ["availability", "calendar"],
    },
    {
      label: "Invoices",
      path: "/dashboard/otherstaff/invoice",
      keywords: ["invoice", "billing"],
    },
    {
      label: "Chat",
      path: "/dashboard/otherstaff/chat",
      keywords: ["messages", "inbox"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/otherstaff/interests",
      keywords: ["interests", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/otherstaff/learning",
      keywords: ["learning", "training"],
    },
    {
      label: "Logout",
      path: "/dashboard/otherstaff/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const explorerOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/explorer/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/explorer/onboarding-v2",
      keywords: ["profile", "onboarding"],
    },
    {
      label: "Public Shifts",
      path: "/dashboard/explorer/shifts/public",
      keywords: ["public shifts", "browse"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/explorer/shifts/community",
      keywords: ["community", "platform shifts"],
    },
    {
      label: "Chat",
      path: "/dashboard/explorer/chat",
      keywords: ["messages", "inbox"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/explorer/interests",
      keywords: ["interests", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/explorer/learning",
      keywords: ["learning", "training"],
    },
    {
      label: "Logout",
      path: "/dashboard/explorer/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const defaultOptions: SearchOption[] = Array.from(
  new Map(
    [...ownerOptions, ...organizationOptions, ...pharmacistOptions, ...otherStaffOptions, ...explorerOptions].map((option) => [
      option.path,
      option,
    ])
  ).values()
);

const ROLE_SEARCH_OPTIONS: Record<string, SearchOption[]> = {
  OWNER: ownerOptions,
  PHARMACY_ADMIN: ownerOptions,
  ORG_ADMIN: organizationOptions,
  ORG_OWNER: organizationOptions,
  ORG_STAFF: organizationOptions,
  ORGANIZATION: organizationOptions,
  PHARMACIST: pharmacistOptions,
  OTHER_STAFF: otherStaffOptions,
  EXPLORER: explorerOptions,
  DEFAULT: defaultOptions,
};

const CHAT_ROUTES: Record<string, string> = {
  OWNER: "/dashboard/owner/chat",
  PHARMACY_ADMIN: "/dashboard/owner/chat",
  ORG_ADMIN: "/dashboard/organization/chat",
  ORG_OWNER: "/dashboard/organization/chat",
  ORG_STAFF: "/dashboard/organization/chat",
  ORGANIZATION: "/dashboard/organization/chat",
  PHARMACIST: "/dashboard/pharmacist/chat",
  OTHER_STAFF: "/dashboard/otherstaff/chat",
  EXPLORER: "/dashboard/explorer/chat",
};

type MessageSummary = {
  conversation_id: number;
  conversation_title: string;
  sender_name: string;
  body_preview: string;
  unread: number;
};

export default function TopBarActions() {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const { user, token, refreshUnreadCount } = useAuth();
  const navigate = useNavigate();
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));
  const [query, setQuery] = React.useState("");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [notificationAnchor, setNotificationAnchor] = React.useState<HTMLElement | null>(null);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [messageAnchor, setMessageAnchor] = React.useState<HTMLElement | null>(null);
  const [messageSummaries, setMessageSummaries] = React.useState<Record<number, MessageSummary>>({});
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const wsRef = React.useRef<WebSocket | null>(null);

  const filterOptions = React.useMemo(
    () =>
      createFilterOptions<SearchOption>({
        ignoreAccents: true,
        matchFrom: "any",
        stringify: (option) =>
          [option.label, option.description, ...(option.keywords || [])].filter(Boolean).join(" "),
      }),
    []
  );

  const options = React.useMemo(() => {
    const roleKey = (user?.role || "DEFAULT").toUpperCase();
    return ROLE_SEARCH_OPTIONS[roleKey] ?? ROLE_SEARCH_OPTIONS.DEFAULT;
  }, [user?.role]);

  const searchFieldSx = React.useMemo(
    () => ({
      width: { xs: "100%", sm: 280 },
      "& .MuiOutlinedInput-root": {
        borderRadius: theme.shape.borderRadius,
        backgroundColor: alpha(theme.palette.common.white, 0.04),
        transition: theme.transitions.create(["background-color", "box-shadow", "border-color"]),
        "&:hover": {
          backgroundColor: alpha(theme.palette.common.white, 0.08),
        },
        "&.Mui-focused": {
          backgroundColor: alpha(theme.palette.common.white, 0.1),
          boxShadow: theme.shadows[2],
        },
        "& fieldset": {
          borderColor: alpha(theme.palette.divider, 0.6),
        },
        "&:hover fieldset": {
          borderColor: alpha(theme.palette.primary.main, 0.4),
        },
        "&.Mui-focused fieldset": {
          borderColor: theme.palette.primary.main,
        },
      },
    }),
    [theme]
  );

  const closeMobile = React.useCallback(() => {
    setMobileOpen(false);
    setQuery("");
  }, []);

  const handleNavigate = React.useCallback(
    (option: SearchOption | null) => {
      if (!option) return;
      navigate(option.path);
      setQuery("");
      if (downSm) {
        closeMobile();
      }
    },
    [navigate, downSm, closeMobile]
  );

  const handleEnterSubmit = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" || !query.trim()) return;
      const matches = filterOptions(options, { inputValue: query });
      const firstMatch = matches[0];
      if (firstMatch) {
        event.preventDefault();
        handleNavigate(firstMatch);
      }
    },
    [filterOptions, options, query, handleNavigate]
  );

  const chatRoute = React.useMemo(() => {
    const roleKey = (user?.role || "OWNER").toUpperCase();
    return CHAT_ROUTES[roleKey] ?? "/dashboard/owner/chat";
  }, [user?.role]);

  const unreadMessageEntries = React.useMemo(
    () => Object.values(messageSummaries).filter((entry) => entry.unread > 0),
    [messageSummaries]
  );

  const anyUnreadNotifications = React.useMemo(
    () => notifications.some((item) => !item.read_at),
    [notifications]
  );

  React.useEffect(() => {
    const total = Object.values(messageSummaries).reduce(
      (sum, item) => sum + (item.unread || 0),
      0
    );
    setUnreadMessages(total);
  }, [messageSummaries]);

  React.useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadNotifications(0);
      setNotificationsLoading(false);
      return;
    }
    let cancelled = false;
    setNotificationsLoading(true);
    fetchNotifications()
      .then((data) => {
        if (cancelled) return;
        const response: any = data;
        const list: NotificationItem[] = Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response)
          ? response
          : [];
        setNotifications(list);
        const unreadCount =
          typeof response?.unread === "number"
            ? response.unread
            : typeof response?.count_unread === "number"
            ? response.count_unread
            : list.filter((item) => !item.read_at).length;
        setUnreadNotifications(unreadCount);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load notifications", error);
        setNotifications([]);
        setUnreadNotifications(0);
      })
      .finally(() => {
        if (!cancelled) {
          setNotificationsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  React.useEffect(() => {
    if (!token) {
      setMessageSummaries({});
      return;
    }
    let cancelled = false;

    apiClient
      .get(API_ENDPOINTS.rooms)
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data;
        const rawRooms: any[] = Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
          ? payload
          : [];
        const next: Record<number, MessageSummary> = {};
        rawRooms.forEach((room) => {
          if (!room || typeof room.id !== "number") {
            return;
          }
          const unread = room.unread_count || 0;
          if (!unread) {
            return;
          }
          const lastMessage =
            room.last_message ||
            room.latest_message ||
            room.most_recent_message ||
            room.recent_message ||
            {};
          const senderName =
            lastMessage?.sender_name ||
            lastMessage?.sender?.name ||
            lastMessage?.sender?.user?.full_name ||
            lastMessage?.sender?.user?.email ||
            lastMessage?.sender?.user_details?.full_name ||
            lastMessage?.sender?.user_details?.email ||
            "";
          const body =
            (lastMessage?.body || lastMessage?.text || lastMessage?.preview || "").toString();
          next[room.id] = {
            conversation_id: room.id,
            conversation_title:
              room.title || room.name || room.display_name || room.conversation_title || "",
            sender_name: senderName,
            body_preview: body,
            unread,
          };
        });
        setMessageSummaries(next);
        refreshUnreadCount();
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load chat rooms", error);
        setMessageSummaries({});
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshUnreadCount]);

  const wsUrl = React.useMemo(() => {
    if (!token) return null;
    try {
      const apiBase = (API_BASE_URL as string | undefined) ?? window.location.origin;
      const resolved = new URL(apiBase, window.location.origin);
      const wsProtocol = resolved.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${resolved.host}/ws/notifications/?token=${encodeURIComponent(token)}`;
    } catch {
      const { protocol, host } = window.location;
      const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${host}/ws/notifications/?token=${encodeURIComponent(token)}`;
    }
  }, [token]);

  React.useEffect(() => {
    if (!wsUrl) {
      return;
    }
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        switch (payload.type) {
          case "notification.counter":
            if (typeof payload.unread === "number") {
              setUnreadNotifications(payload.unread);
            }
            break;
          case "notification.created":
            if (payload.notification) {
              setNotifications((prev) => {
                const next = [
                  payload.notification as NotificationItem,
                  ...prev.filter((item) => item.id !== payload.notification.id),
                ].slice(0, 25);
                setUnreadNotifications(next.filter((item) => !item.read_at).length);
                return next;
              });
            }
            break;
          case "notification.updated":
            if (payload.notification) {
              setNotifications((prev) => {
                const next = prev.map((item) =>
                  item.id === payload.notification.id
                    ? (payload.notification as NotificationItem)
                    : item
                );
                setUnreadNotifications(next.filter((item) => !item.read_at).length);
                return next;
              });
            }
            break;
          case "message.badge":
            if (payload.conversation_id) {
              setMessageSummaries((prev) => {
                const next = { ...prev };
                const existing = next[payload.conversation_id] || {
                  conversation_id: payload.conversation_id,
                  conversation_title: "",
                  sender_name: "",
                  body_preview: "",
                  unread: 0,
                };
                next[payload.conversation_id] = {
                  ...existing,
                  conversation_title:
                    payload.conversation_title ?? existing.conversation_title,
                  sender_name: payload.sender_name ?? existing.sender_name,
                  body_preview: payload.body_preview ?? existing.body_preview,
                  unread: typeof payload.unread === "number" ? payload.unread : existing.unread,
                };
                return next;
              });
              refreshUnreadCount();
            }
            break;
          case "message.read":
            if (payload.conversation_id) {
              setMessageSummaries((prev) => {
                const next = { ...prev };
                if (next[payload.conversation_id]) {
                  next[payload.conversation_id] = {
                    ...next[payload.conversation_id],
                    unread: 0,
                  };
                }
                return next;
              });
              refreshUnreadCount();
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.error("Failed to process websocket message", error);
      }
    };

    socket.onerror = (error) => {
      console.error("Notifications websocket error", error);
    };

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };

    return () => {
      socket.close();
    };
  }, [wsUrl, refreshUnreadCount]);

  const handleOpenNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const markAllNotifications = React.useCallback(async () => {
    const unreadIds = notifications.filter((item) => !item.read_at).map((item) => item.id);
    if (!unreadIds.length) {
      return;
    }
    try {
      const res = await markNotificationsRead(unreadIds);
      const nowIso = new Date().toISOString();
      setUnreadNotifications(res.unread ?? 0);
      setNotifications((prev) =>
        prev.map((item) => (item.read_at ? item : { ...item, read_at: nowIso }))
      );
    } catch (error) {
      console.error("Failed to mark notifications read", error);
    }
  }, [notifications]);

  const handleCloseNotifications = React.useCallback(() => {
    setNotificationAnchor(null);
    if (anyUnreadNotifications) {
      void markAllNotifications();
    }
  }, [anyUnreadNotifications, markAllNotifications]);

  const handleOpenMessages = (event: React.MouseEvent<HTMLElement>) => {
    setMessageAnchor(event.currentTarget);
  };

  const handleCloseMessages = React.useCallback(() => {
    setMessageAnchor(null);
  }, []);

  const handleNotificationNavigate = React.useCallback(
    (item: NotificationItem) => {
      if (!item.action_url) {
        handleCloseNotifications();
        return;
      }
      try {
        const target = new URL(item.action_url, window.location.origin);
        if (target.origin === window.location.origin) {
          navigate(`${target.pathname}${target.search}${target.hash}`);
        } else {
          window.location.href = target.toString();
        }
      } catch {
        const normalized = item.action_url.startsWith('/')
          ? item.action_url
          : `/${item.action_url}`;
        navigate(normalized);
      }
      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((existing) =>
          existing.id === item.id ? { ...existing, read_at: existing.read_at ?? nowIso } : existing
        )
      );
      if (!item.read_at) {
        setUnreadNotifications((prev) => Math.max(0, prev - 1));
      }
      void markNotificationsRead([item.id]).catch((error) =>
        console.error('Failed to mark notification read', error)
      );
      handleCloseNotifications();
    },
    [handleCloseNotifications, navigate]
  );
  const handleMessageNavigate = React.useCallback(
    (summary: MessageSummary) => {
      handleCloseMessages();
      setMessageSummaries((prev) => {
        const next = { ...prev };
        if (next[summary.conversation_id]) {
          next[summary.conversation_id] = { ...next[summary.conversation_id], unread: 0 };
        }
        return next;
      });
      refreshUnreadCount();
      navigate(chatRoute, { state: { conversationId: summary.conversation_id } });
    },
    [chatRoute, handleCloseMessages, navigate, refreshUnreadCount]
  );

  const renderSearchField = React.useCallback(
    (autoFocus = false) => (
      <Autocomplete
        sx={searchFieldSx}
        options={options}
        filterOptions={filterOptions}
        autoComplete
        autoHighlight
        includeInputInList
        clearOnBlur={false}
        openOnFocus
        value={null}
        onChange={(_, value) => handleNavigate(value)}
        inputValue={query}
        onInputChange={(_, value) => setQuery(value)}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.path === value.path}
        noOptionsText={query ? "No matches found" : "Start typing to search pages"}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Typography variant="body2" fontWeight={600}>
              {option.label}
            </Typography>
            {option.description && (
              <Typography variant="caption" color="text.secondary">
                {option.description}
              </Typography>
            )}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus={autoFocus}
            placeholder="Search pages..."
            size="small"
            onKeyDown={handleEnterSubmit}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start" sx={{ color: "text.secondary" }}>
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
    ),
    [filterOptions, handleEnterSubmit, handleNavigate, options, query, searchFieldSx]
  );

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pr: { xs: 0.5, md: 1.5 } }}>
      {downSm ? (
        <>
          <Tooltip title="Search">
            <IconButton color="inherit" size="small" aria-label="open search" onClick={() => setMobileOpen(true)}>
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Dialog open={mobileOpen} onClose={closeMobile} fullWidth maxWidth="sm">
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pr: 1,
              }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                Search pages
              </Typography>
              <IconButton size="small" onClick={closeMobile} aria-label="close search dialog">
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0, pb: 2 }}>{renderSearchField(true)}</DialogContent>
          </Dialog>
        </>
      ) : (
        renderSearchField()
      )}

      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          size="small"
          aria-label="notifications"
          onClick={handleOpenNotifications}
        >
          <Badge
            color="error"
            overlap="circular"
            badgeContent={unreadNotifications}
          >
            <NotificationsNoneOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title="Messages">
        <IconButton
          color="inherit"
          size="small"
          aria-label="messages"
          onClick={handleOpenMessages}
        >
          <Badge color="error" overlap="circular" badgeContent={unreadMessages}>
            <ChatBubbleOutlineOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(notificationAnchor)}
        anchorEl={notificationAnchor}
        onClose={handleCloseNotifications}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxHeight: 420, p: 0.5 } }}
      >
        {notificationsLoading ? (
          <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={20} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {notifications.map((item, index) => (
              <React.Fragment key={item.id}>
                <ListItem disablePadding alignItems="flex-start">
                  <ListItemButton
                    onClick={() => handleNotificationNavigate(item)}
                    sx={{
                      alignItems: "flex-start",
                      bgcolor: item.read_at ? "transparent" : alpha(theme.palette.primary.main, 0.08),
                    }}
                  >
                    <ListItemText
                      primary={item.title}
                      secondary={item.body || dayjs.utc(item.created_at).local().toDate().toLocaleString()}
                      primaryTypographyProps={{ fontWeight: item.read_at ? 500 : 700 }}
                      secondaryTypographyProps={{ color: "text.secondary" }}
                    />
                  </ListItemButton>
                </ListItem>
                {index < notifications.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
            {anyUnreadNotifications && (
              <>
                <Divider component="li" />
                <ListItem disablePadding>
                  <ListItemButton onClick={() => void markAllNotifications()}>
                    <ListItemText
                      primary="Mark all as read"
                      primaryTypographyProps={{ align: "center", fontWeight: 600 }}
                    />
                  </ListItemButton>
                </ListItem>
              </>
            )}
          </List>
        )}
      </Popover>

      <Popover
        open={Boolean(messageAnchor)}
        anchorEl={messageAnchor}
        onClose={handleCloseMessages}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxHeight: 420, p: 0.5 } }}
      >
        {unreadMessageEntries.length === 0 ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No new messages
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {unreadMessageEntries.map((msg, index) => {
              const title = msg.sender_name
                ? `${msg.sender_name} messaged you`
                : msg.conversation_title
                ? `New messages in ${msg.conversation_title}`
                : "New messages";
              const preview = msg.body_preview || "Open chat to read";
              return (
                <React.Fragment key={msg.conversation_id}>
                  <ListItem disablePadding alignItems="flex-start">
                    <ListItemButton onClick={() => handleMessageNavigate(msg)}>
                      <ListItemText
                        primary={title}
                        secondary={preview}
                        primaryTypographyProps={{ fontWeight: 600 }}
                      />
                      <Badge color="error" badgeContent={msg.unread} />
                    </ListItemButton>
                  </ListItem>
                  {index < unreadMessageEntries.length - 1 && <Divider component="li" />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Popover>

      <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
        <IconButton color="inherit" size="small" onClick={toggleColorMode} aria-label="toggle theme">
          {mode === "dark" ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

