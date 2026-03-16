export type VisibilityOption = "everyone" | "following" | "nobody";
export type VerificationRequestStatus = "not_requested" | "pending" | "verified";
export type SubscriptionPlan = "starter" | "nrw_plus" | "nrw_pro";

export type AppSettingsPreferences = {
  profile: {
    web: string;
    showAccountSuggestions: boolean;
  };
  notifications: {
    likes: boolean;
    comments: boolean;
    messages: boolean;
    marketing: boolean;
  };
  pro: {
    businessProfile: boolean;
    showContactButton: boolean;
    leadInbox: boolean;
  };
  creator: {
    creatorMode: boolean;
    brandedContent: boolean;
    analyticsDigest: boolean;
  };
  privacy: {
    privateAccount: boolean;
    activityStatus: boolean;
    searchableByEmail: boolean;
    searchableByPhone: boolean;
  };
  closeFriends: {
    members: string[];
  };
  blocked: {
    members: string[];
  };
  story: {
    allowReplies: boolean;
    allowReshare: boolean;
    showLocation: boolean;
  };
  messages: {
    allowRequests: boolean;
    onlyFollowing: boolean;
    readReceipts: boolean;
  };
  tags: {
    tagsFrom: VisibilityOption;
    mentionsFrom: VisibilityOption;
  };
  comments: {
    commentsFrom: VisibilityOption;
    hideOffensive: boolean;
    manualApproval: boolean;
  };
  security: {
    twoFactor: boolean;
    newDeviceAlerts: boolean;
    loginApprovals: boolean;
  };
  verification: {
    status: VerificationRequestStatus;
    requestedAt: string | null;
    publicLabel: string;
  };
  subscription: {
    currentPlan: SubscriptionPlan;
    billingActive: boolean;
  };
};

export const SETTINGS_PREFERENCES_STORAGE_KEY = "nrw.settings.preferences";

export const DEFAULT_SETTINGS_PREFERENCES: AppSettingsPreferences = {
  profile: {
    web: "",
    showAccountSuggestions: true,
  },
  notifications: {
    likes: true,
    comments: true,
    messages: true,
    marketing: false,
  },
  pro: {
    businessProfile: false,
    showContactButton: false,
    leadInbox: false,
  },
  creator: {
    creatorMode: false,
    brandedContent: false,
    analyticsDigest: true,
  },
  privacy: {
    privateAccount: false,
    activityStatus: true,
    searchableByEmail: true,
    searchableByPhone: false,
  },
  closeFriends: {
    members: [],
  },
  blocked: {
    members: [],
  },
  story: {
    allowReplies: true,
    allowReshare: true,
    showLocation: true,
  },
  messages: {
    allowRequests: true,
    onlyFollowing: false,
    readReceipts: true,
  },
  tags: {
    tagsFrom: "everyone",
    mentionsFrom: "everyone",
  },
  comments: {
    commentsFrom: "everyone",
    hideOffensive: true,
    manualApproval: false,
  },
  security: {
    twoFactor: true,
    newDeviceAlerts: true,
    loginApprovals: true,
  },
  verification: {
    status: "not_requested",
    requestedAt: null,
    publicLabel: "NRW Verified",
  },
  subscription: {
    currentPlan: "starter",
    billingActive: false,
  },
};

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeVisibility(value: unknown, fallback: VisibilityOption): VisibilityOption {
  return value === "everyone" || value === "following" || value === "nobody" ? value : fallback;
}

function normalizeVerificationStatus(
  value: unknown,
  fallback: VerificationRequestStatus,
): VerificationRequestStatus {
  return value === "not_requested" || value === "pending" || value === "verified" ? value : fallback;
}

function normalizeSubscriptionPlan(value: unknown, fallback: SubscriptionPlan): SubscriptionPlan {
  return value === "starter" || value === "nrw_plus" || value === "nrw_pro" ? value : fallback;
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().replace(/^@+/, "") : ""))
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

function getStorageKey(userId?: string | null) {
  return `${SETTINGS_PREFERENCES_STORAGE_KEY}:${userId ?? "guest"}`;
}

export function normalizeSettingsPreferences(value: unknown): AppSettingsPreferences {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const profile = source.profile && typeof source.profile === "object" ? (source.profile as Record<string, unknown>) : {};
  const notifications =
    source.notifications && typeof source.notifications === "object"
      ? (source.notifications as Record<string, unknown>)
      : {};
  const pro = source.pro && typeof source.pro === "object" ? (source.pro as Record<string, unknown>) : {};
  const creator = source.creator && typeof source.creator === "object" ? (source.creator as Record<string, unknown>) : {};
  const privacy = source.privacy && typeof source.privacy === "object" ? (source.privacy as Record<string, unknown>) : {};
  const closeFriends =
    source.closeFriends && typeof source.closeFriends === "object"
      ? (source.closeFriends as Record<string, unknown>)
      : {};
  const blocked = source.blocked && typeof source.blocked === "object" ? (source.blocked as Record<string, unknown>) : {};
  const story = source.story && typeof source.story === "object" ? (source.story as Record<string, unknown>) : {};
  const messages = source.messages && typeof source.messages === "object" ? (source.messages as Record<string, unknown>) : {};
  const tags = source.tags && typeof source.tags === "object" ? (source.tags as Record<string, unknown>) : {};
  const comments = source.comments && typeof source.comments === "object" ? (source.comments as Record<string, unknown>) : {};
  const security = source.security && typeof source.security === "object" ? (source.security as Record<string, unknown>) : {};
  const verification =
    source.verification && typeof source.verification === "object"
      ? (source.verification as Record<string, unknown>)
      : {};
  const subscription =
    source.subscription && typeof source.subscription === "object"
      ? (source.subscription as Record<string, unknown>)
      : {};

  return {
    profile: {
      web: normalizeString(profile.web, DEFAULT_SETTINGS_PREFERENCES.profile.web),
      showAccountSuggestions: normalizeBoolean(
        profile.showAccountSuggestions,
        DEFAULT_SETTINGS_PREFERENCES.profile.showAccountSuggestions,
      ),
    },
    notifications: {
      likes: normalizeBoolean(notifications.likes, DEFAULT_SETTINGS_PREFERENCES.notifications.likes),
      comments: normalizeBoolean(notifications.comments, DEFAULT_SETTINGS_PREFERENCES.notifications.comments),
      messages: normalizeBoolean(notifications.messages, DEFAULT_SETTINGS_PREFERENCES.notifications.messages),
      marketing: normalizeBoolean(notifications.marketing, DEFAULT_SETTINGS_PREFERENCES.notifications.marketing),
    },
    pro: {
      businessProfile: normalizeBoolean(pro.businessProfile, DEFAULT_SETTINGS_PREFERENCES.pro.businessProfile),
      showContactButton: normalizeBoolean(pro.showContactButton, DEFAULT_SETTINGS_PREFERENCES.pro.showContactButton),
      leadInbox: normalizeBoolean(pro.leadInbox, DEFAULT_SETTINGS_PREFERENCES.pro.leadInbox),
    },
    creator: {
      creatorMode: normalizeBoolean(creator.creatorMode, DEFAULT_SETTINGS_PREFERENCES.creator.creatorMode),
      brandedContent: normalizeBoolean(creator.brandedContent, DEFAULT_SETTINGS_PREFERENCES.creator.brandedContent),
      analyticsDigest: normalizeBoolean(creator.analyticsDigest, DEFAULT_SETTINGS_PREFERENCES.creator.analyticsDigest),
    },
    privacy: {
      privateAccount: normalizeBoolean(privacy.privateAccount, DEFAULT_SETTINGS_PREFERENCES.privacy.privateAccount),
      activityStatus: normalizeBoolean(privacy.activityStatus, DEFAULT_SETTINGS_PREFERENCES.privacy.activityStatus),
      searchableByEmail: normalizeBoolean(
        privacy.searchableByEmail,
        DEFAULT_SETTINGS_PREFERENCES.privacy.searchableByEmail,
      ),
      searchableByPhone: normalizeBoolean(
        privacy.searchableByPhone,
        DEFAULT_SETTINGS_PREFERENCES.privacy.searchableByPhone,
      ),
    },
    closeFriends: {
      members: normalizeList(closeFriends.members),
    },
    blocked: {
      members: normalizeList(blocked.members),
    },
    story: {
      allowReplies: normalizeBoolean(story.allowReplies, DEFAULT_SETTINGS_PREFERENCES.story.allowReplies),
      allowReshare: normalizeBoolean(story.allowReshare, DEFAULT_SETTINGS_PREFERENCES.story.allowReshare),
      showLocation: normalizeBoolean(story.showLocation, DEFAULT_SETTINGS_PREFERENCES.story.showLocation),
    },
    messages: {
      allowRequests: normalizeBoolean(messages.allowRequests, DEFAULT_SETTINGS_PREFERENCES.messages.allowRequests),
      onlyFollowing: normalizeBoolean(messages.onlyFollowing, DEFAULT_SETTINGS_PREFERENCES.messages.onlyFollowing),
      readReceipts: normalizeBoolean(messages.readReceipts, DEFAULT_SETTINGS_PREFERENCES.messages.readReceipts),
    },
    tags: {
      tagsFrom: normalizeVisibility(tags.tagsFrom, DEFAULT_SETTINGS_PREFERENCES.tags.tagsFrom),
      mentionsFrom: normalizeVisibility(tags.mentionsFrom, DEFAULT_SETTINGS_PREFERENCES.tags.mentionsFrom),
    },
    comments: {
      commentsFrom: normalizeVisibility(comments.commentsFrom, DEFAULT_SETTINGS_PREFERENCES.comments.commentsFrom),
      hideOffensive: normalizeBoolean(comments.hideOffensive, DEFAULT_SETTINGS_PREFERENCES.comments.hideOffensive),
      manualApproval: normalizeBoolean(comments.manualApproval, DEFAULT_SETTINGS_PREFERENCES.comments.manualApproval),
    },
    security: {
      twoFactor: normalizeBoolean(security.twoFactor, DEFAULT_SETTINGS_PREFERENCES.security.twoFactor),
      newDeviceAlerts: normalizeBoolean(
        security.newDeviceAlerts,
        DEFAULT_SETTINGS_PREFERENCES.security.newDeviceAlerts,
      ),
      loginApprovals: normalizeBoolean(
        security.loginApprovals,
        DEFAULT_SETTINGS_PREFERENCES.security.loginApprovals,
      ),
    },
    verification: {
      status: normalizeVerificationStatus(
        verification.status,
        DEFAULT_SETTINGS_PREFERENCES.verification.status,
      ),
      requestedAt:
        typeof verification.requestedAt === "string" && verification.requestedAt.trim()
          ? verification.requestedAt
          : null,
      publicLabel: normalizeString(
        verification.publicLabel,
        DEFAULT_SETTINGS_PREFERENCES.verification.publicLabel,
      ),
    },
    subscription: {
      currentPlan: normalizeSubscriptionPlan(
        subscription.currentPlan,
        DEFAULT_SETTINGS_PREFERENCES.subscription.currentPlan,
      ),
      billingActive: normalizeBoolean(
        subscription.billingActive,
        DEFAULT_SETTINGS_PREFERENCES.subscription.billingActive,
      ),
    },
  };
}

export function getStoredSettingsPreferences(userId?: string | null): AppSettingsPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return DEFAULT_SETTINGS_PREFERENCES;
    return normalizeSettingsPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS_PREFERENCES;
  }
}

export function storeSettingsPreferences(userId: string | null | undefined, value: AppSettingsPreferences) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(normalizeSettingsPreferences(value)));
  } catch {
    // ignore localStorage write failures
  }
}
