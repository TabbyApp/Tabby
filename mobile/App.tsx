import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';

import Slider from '@react-native-community/slider';
import Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef, DefaultTheme, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LinkIOSPresentationStyle,
  LinkLogLevel,
  create as createPlaidSession,
  dismissLink,
  open as openPlaidLink,
} from 'react-native-plaid-link-sdk';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SocketProvider, useSocketState } from './src/contexts/SocketContext';
import {
  api,
  AppNotification,
  GroupDetail,
  ParsedReceipt,
  UploadAsset,
  assetUrl,
  getApiBase,
} from './src/lib/api';
import { palette, radii, shadows, spacing } from './src/lib/theme';
import { clamp, formatCurrency, formatRelativeTime, parseInviteTokenFromUrl, validateDateOfBirth } from './src/lib/utils';

const GROUP_COLORS = ['#16A34A', '#A855F7', '#22C55E', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#84CC16'];

type RootStackParamList = {
  MainTabs: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
  ReceiptScan: { groupId: string; returnToGroupAfterUpload?: boolean };
  ReceiptItems: { groupId: string; receiptId: string };
  ProcessingPayment: { groupId: string; transactionId: string };
  AcceptInvite: { token: string };
  Notifications: undefined;
  Activity: undefined;
  Account: undefined;
  Settings: undefined;
  Wallet: undefined;
  CardDetails: { groupId: string };
};

type TabParamList = {
  Home: undefined;
  Groups: undefined;
  Activity: undefined;
};

type LocalInviteNotification = {
  token: string;
  groupName?: string;
  inviterName?: string;
  members?: number;
  createdAt: string;
};

type ReceiptReviewDraft = ParsedReceipt;

const LOCAL_INVITES_KEY = 'tabby_mobile_local_invites';
const PUSH_TOKEN_KEY = 'tabby_mobile_push_token';
const queryClient = new QueryClient();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function readLocalInvites(): Promise<LocalInviteNotification[]> {
  const raw = await SecureStore.getItemAsync(LOCAL_INVITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LocalInviteNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalInvites(items: LocalInviteNotification[]) {
  await SecureStore.setItemAsync(LOCAL_INVITES_KEY, JSON.stringify(items));
}

function validateReceipt(receipt: ReceiptReviewDraft) {
  const subtotal = receipt.totals.subtotal ?? 0;
  const tax = receipt.totals.tax ?? 0;
  const tip = receipt.totals.tip ?? 0;
  const total = receipt.totals.total ?? 0;
  const lineSum = receipt.lineItems.reduce((sum, item) => sum + item.price, 0);
  const issues: string[] = [];
  if (Math.abs(subtotal + tax + tip - total) > 0.02) {
    issues.push('Totals do not reconcile.');
  }
  if (Math.abs(lineSum - subtotal) > 0.02) {
    issues.push('Line items do not match subtotal.');
  }
  return { isValid: issues.length === 0, issues };
}

async function launchPlaidFlow(onLinked: () => Promise<void>) {
  const response = await api.plaid.linkToken();
  createPlaidSession({
    token: response.linkToken,
    noLoadingState: false,
  });
  openPlaidLink({
    iOSPresentationStyle: LinkIOSPresentationStyle.MODAL,
    logLevel: LinkLogLevel.ERROR,
    onSuccess: async (success: any) => {
      await api.plaid.exchange(success.publicToken);
      await onLinked();
      dismissLink();
    },
    onExit: () => {
      dismissLink();
    },
  });
}

function TabbyWordmark() {
  return (
    <View style={styles.wordmarkRow}>
      <MaterialCommunityIcons name="cat" size={26} color="#10B981" />
      <Text style={styles.wordmarkText}>tabby</Text>
    </View>
  );
}

function ScreenHeader({
  title,
  onBack,
  right,
  showWordmark,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showWordmark?: boolean;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderMain}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.roundIconButton}>
            <Feather name="chevron-left" size={20} color={palette.foreground} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {showWordmark ? <TabbyWordmark /> : <Text style={styles.screenTitle}>{title}</Text>}
        </View>
        {right}
      </View>
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentedWrap}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segmentedItem, value === option.value ? styles.segmentedItemActive : null]}
        >
          <Text style={value === option.value ? styles.segmentedItemTextActive : styles.segmentedItemText}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BottomNavigationBar({
  currentPage,
  onNavigate,
  onProfilePress,
}: {
  currentPage: 'home' | 'groups' | 'activity';
  onNavigate: (page: 'home' | 'groups' | 'createGroup' | 'activity') => void;
  onProfilePress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const navItems: { key: 'home' | 'groups' | 'activity'; icon: 'home' | 'people' | 'receipt'; label: string }[] = [
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'groups', icon: 'people', label: 'Groups' },
  ];
  const navItemsAfter: { key: 'activity'; icon: 'receipt'; label: string }[] = [
    { key: 'activity', icon: 'receipt', label: 'Activity' },
  ];
  const navPressStyle = ({ pressed }: { pressed: boolean }) => [styles.navItem, pressed ? styles.navItemPressed : null];
  return (
    <View style={[styles.bottomNavWrap, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View style={styles.bottomNavInner}>
        {navItems.map((item) => {
          const active = currentPage === item.key;
          return (
            <Pressable key={item.key} onPress={() => onNavigate(item.key)} style={navPressStyle}>
              <Ionicons name={active ? item.icon : `${item.icon}-outline` as any} size={22} color={active ? palette.foreground : palette.muted} />
              <Text style={active ? styles.navLabelActive : styles.navLabel}>{item.label}</Text>
              {active ? <View style={styles.navDot} /> : null}
            </Pressable>
          );
        })}

        <Pressable onPress={() => onNavigate('createGroup')} style={navPressStyle}>
          <View style={styles.addNavButton}>
            <Feather name="plus" size={20} color="#FFFFFF" />
          </View>
        </Pressable>

        {navItemsAfter.map((item) => {
          const active = currentPage === item.key;
          return (
            <Pressable key={item.key} onPress={() => onNavigate(item.key)} style={navPressStyle}>
              <Ionicons name={active ? item.icon : `${item.icon}-outline` as any} size={22} color={active ? palette.foreground : palette.muted} />
              <Text style={active ? styles.navLabelActive : styles.navLabel}>{item.label}</Text>
              {active ? <View style={styles.navDot} /> : null}
            </Pressable>
          );
        })}

        <Pressable onPress={onProfilePress} style={navPressStyle}>
          <Ionicons name="person-outline" size={22} color={palette.muted} />
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileSheet({
  visible,
  userName,
  userEmail,
  onClose,
  onGoAccount,
  onGoSettings,
  onGoWallet,
}: {
  visible: boolean;
  userName?: string;
  userEmail?: string;
  onClose: () => void;
  onGoAccount: () => void;
  onGoSettings: () => void;
  onGoWallet: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.profileSheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <View style={styles.profileSheetHeader}>
            <Text style={styles.profileSheetTitle}>Profile</Text>
            <Pressable onPress={onClose} style={styles.smallIconButton}>
              <Feather name="x" size={16} color={palette.foreground} />
            </Pressable>
          </View>
          <View style={styles.profileIdentity}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={28} color={palette.foreground} />
            </View>
            <View>
              <Text style={styles.profileName}>{userName ?? 'User'}</Text>
              <Text style={styles.profileEmail}>{userEmail ?? ''}</Text>
            </View>
          </View>
          {[
            { label: 'Account', subtitle: 'Manage your profile', icon: 'person-outline', onPress: onGoAccount },
            { label: 'Virtual Wallet', subtitle: 'Manage your cards', icon: 'wallet-outline', onPress: onGoWallet },
            { label: 'Settings', subtitle: 'App preferences', icon: 'settings-outline', onPress: onGoSettings },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={styles.profileSheetRow}
            >
              <View style={styles.profileSheetIcon}>
                <Ionicons name={item.icon as any} size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileSheetRowTitle}>{item.label}</Text>
                <Text style={styles.profileSheetRowSubtitle}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={palette.muted} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AppButton({
  label,
  onPress,
  disabled,
  kind = 'primary',
  style: extraStyle,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
  style?: any;
}) {
  const backgroundColor =
    kind === 'primary' ? palette.primaryStrong : kind === 'danger' ? '#3A1820' : palette.cardMuted;
  const color = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? palette.danger : palette.foreground;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => void onPress()}
      style={[styles.button, { backgroundColor, opacity: disabled ? 0.5 : 1 }, extraStyle]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        style={[styles.input, multiline ? styles.textarea : null, editable === false ? styles.inputDisabled : null]}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        autoCapitalize="none"
      />
    </View>
  );
}

function Page({
  title,
  children,
  scroll = true,
  right,
  onBack,
  showWordmark,
  bottomInset = true,
}: {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
  showWordmark?: boolean;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.pageContent, { paddingBottom: bottomInset ? Math.max(insets.bottom + 124, 144) : Math.max(insets.bottom + 24, 32) }]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
      <ScreenHeader title={title} onBack={onBack} right={right} showWordmark={showWordmark} />
      {scroll ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

function SectionCard({ children, style: extraStyle }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, shadows.card, extraStyle]}>{children}</View>;
}

function LoadingView({ label = 'Loading Tabby...' }: { label?: string }) {
  return (
    <SafeAreaView style={styles.loadingPage}>
      <View style={styles.loadingBadge}>
        <MaterialCommunityIcons name="cat" size={36} color="#10B981" />
      </View>
      <ActivityIndicator color={palette.primary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </SafeAreaView>
  );
}

function useBootstrapRefresh() {
  const { refreshBootstrap } = useAuth();
  const socket = useSocketState();
  useEffect(() => {
    void refreshBootstrap().catch(() => undefined);
  }, [refreshBootstrap, socket.groupsChangedAt]);
}

function AuthScreen({ inviteLabel }: { inviteLabel?: string }) {
  const { login, signup, loginWithPhone } = useAuth();
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (authMode === 'phone') {
        if (!otpSent) {
          const response = await api.auth.sendOtp(phone.replace(/\D/g, ''));
          setDevOtp(response.code ?? null);
          setOtpSent(true);
        } else {
          await loginWithPhone(phone.replace(/\D/g, ''), otpCode);
        }
      } else if (isLogin) {
        await login(email.trim(), password);
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        await signup(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authPage}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.centerHero}>
            <MaterialCommunityIcons name="cat" size={48} color="#10B981" />
            <Text style={styles.heroTitle}>tabby</Text>
            <Text style={styles.heroSubtitle}>Split bills. Track balances. Settle cleanly.</Text>
          </View>

          {inviteLabel ? (
            <SectionCard>
              <Text style={styles.cardTitle}>Pending invite</Text>
              <Text style={styles.bodyText}>Sign in to join {inviteLabel} after your account setup is complete.</Text>
            </SectionCard>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.segment}>
            {(['email', 'phone'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => {
                  setAuthMode(mode);
                  setOtpSent(false);
                  setDevOtp(null);
                  setError('');
                }}
                style={[styles.segmentItem, authMode === mode ? styles.segmentItemActive : null]}
              >
                <Text style={authMode === mode ? styles.segmentLabelActive : styles.segmentLabel}>{mode === 'email' ? 'Email' : 'Phone'}</Text>
              </Pressable>
            ))}
          </View>

          {authMode === 'email' ? (
            <>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter password" />
              {!isLogin ? (
                <Field
                  label="Confirm password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Confirm password"
                />
              ) : null}
              {isLogin ? (
                <Pressable onPress={() => {}} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
                  <Text style={[styles.linkText, { fontSize: 13 }]}>Forgot password?</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="5551234567" editable={!otpSent} />
              {otpSent ? <Field label="Verification code" value={otpCode} onChangeText={setOtpCode} keyboardType="numeric" placeholder="123456" /> : null}
              {otpSent ? (
                <Pressable
                  onPress={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setDevOtp(null);
                  }}
                  style={{ alignSelf: 'flex-start', marginBottom: 8 }}
                >
                  <Text style={[styles.linkText, { fontSize: 13 }]}>Use different number</Text>
                </Pressable>
              ) : null}
            </>
          )}

          <AppButton
            label={
              loading
                ? 'Please wait...'
                : authMode === 'phone'
                  ? otpSent
                    ? isLogin
                      ? 'Verify & Sign In'
                      : 'Verify & Sign Up'
                    : 'Send Code'
                  : isLogin
                    ? 'Log In'
                    : 'Sign Up'
            }
            onPress={handleSubmit}
            disabled={loading}
          />

          <Pressable
            onPress={() => {
              setIsLogin((current) => !current);
              setError('');
              setOtpSent(false);
              setOtpCode('');
              setConfirmPassword('');
            }}
            style={styles.authToggle}
          >
            <Text style={styles.caption}>{isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OnboardingScreen({ pendingInviteToken }: { pendingInviteToken: string | null }) {
  const { user, setUser, refreshBootstrap } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name === 'New User' ? '' : user?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);

  const handleSaveProfile = async () => {
    const validationError = validateDateOfBirth(dateOfBirth);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.users.updateProfile({ name: name.trim(), dateOfBirth });
      setUser(updated);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectBank = async () => {
    setLinking(true);
    setError('');
    try {
      try {
        await launchPlaidFlow(async () => {
          await refreshBootstrap();
        });
      } catch {
        await api.users.linkBank();
        await refreshBootstrap();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link bank account');
    } finally {
      setLinking(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.users.updateProfile({ onboardingCompleted: true });
      setUser(updated);
      await refreshBootstrap();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to finish setup';
      if (/no valid fields to update/i.test(message)) {
        setUser({ onboardingCompleted: true });
        await refreshBootstrap();
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.authPage}>
      <ScrollView contentContainerStyle={styles.authContent}>
        <View style={styles.progressWrap}>
          {[0, 1].map((index) => (
            <View key={index} style={[styles.progressBar, index <= step ? styles.progressBarActive : null]} />
          ))}
        </View>
        <Text style={[styles.caption, { textAlign: 'center', marginBottom: 16 }]}>Set up your account</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 0 ? (
          <>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: radii.xl, backgroundColor: palette.cardMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="person-outline" size={28} color={palette.primaryStrong} />
              </View>
              <Text style={[styles.heroTitle, { fontSize: 22 }]}>What should we call you?</Text>
              <Text style={[styles.heroSubtitle, { textAlign: 'center' }]}>
                We use this so your groups, receipts, and balances show the right name to everyone.
              </Text>
            </View>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
            <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" keyboardType="numeric" />
            <AppButton label={saving ? 'Saving...' : 'Continue'} onPress={handleSaveProfile} disabled={saving} />
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: radii.xl, backgroundColor: palette.cardMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={28} color={palette.primaryStrong} />
              </View>
              <Text style={[styles.heroTitle, { fontSize: 22 }]}>Connect your bank</Text>
              <Text style={[styles.heroSubtitle, { textAlign: 'center' }]}>
                {pendingInviteToken
                  ? 'You can do this now or later. You\'ll need a linked bank account before you can join this invite.'
                  : 'You can do this now or later. You\'ll need a linked bank account before you can join a group or pay with one in Tabby.'}
              </Text>
            </View>

            <SectionCard>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business-outline" size={20} color={palette.primaryStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Why we ask for this</Text>
                  <Text style={styles.bodyText}>
                    Linking your bank lets Tabby charge your share, create virtual group cards, and keep payment sessions ready when a group settles up.
                  </Text>
                  <Text style={[styles.caption, { marginTop: 8 }]}>
                    Your banking data is encrypted and never shared.
                  </Text>
                </View>
              </View>
            </SectionCard>

            <SectionCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={styles.cardTitle}>Bank status</Text>
                {user?.bank_linked ? (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={14} color={palette.success} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.bodyText}>
                {user?.bank_linked ? 'Your bank account is already connected.' : 'You can skip this for now and finish setup first.'}
              </Text>
              {!user?.bank_linked ? <AppButton label={linking ? 'Connecting...' : 'Connect bank'} onPress={handleConnectBank} disabled={linking} /> : null}
            </SectionCard>

            <View style={styles.rowGap}>
              <AppButton label="Back" onPress={() => setStep(0)} kind="secondary" />
              <AppButton label={saving ? 'Finishing...' : 'Continue to Tabby'} onPress={finish} disabled={saving} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen({ navigation, localInvites }: any) {
  const { user, groups, virtualCards, refreshBootstrap } = useAuth();
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  useBootstrapRefresh();
  useFocusEffect(
    useCallback(() => {
      void refreshBootstrap().catch(() => undefined);
    }, [refreshBootstrap]),
  );
  const activeGroups = groups.filter((group) => {
    if (!group.lastSettledAt) return true;
    return Date.now() - new Date(group.lastSettledAt).getTime() < 15 * 60 * 1000;
  });
  const recentGroups = groups.filter((group) => !!group.lastSettledAt && !activeGroups.some((item) => item.id === group.id));
  const featuredCard = virtualCards[0];
  const totalBalance = virtualCards.reduce((sum, card) => sum + (card.groupTotal ?? 0), 0);

  return (
    <>
      <Page
        showWordmark
        right={
          <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.roundIconButton}>
            <Ionicons name="notifications-outline" size={18} color={palette.foreground} />
            {localInvites?.length ? <View style={styles.notificationDot}><Text style={styles.notificationDotText}>{localInvites.length}</Text></View> : null}
          </Pressable>
        }
      >
        {(featuredCard || groups.length > 0) ? (
          <Pressable
            onPress={() => featuredCard ? navigation.navigate('CardDetails', { groupId: featuredCard.groupId }) : navigation.navigate('Wallet')}
            style={[styles.heroCard, shadows.card]}
          >
            <View style={styles.heroCardTop}>
              <View>
                <Text style={styles.eyebrow}>Virtual Card</Text>
                <Text style={styles.heroCardNumber}>•••• •••• •••• {featuredCard?.cardLastFour ?? '----'}</Text>
              </View>
              <Ionicons name="card-outline" size={22} color={palette.secondaryText} />
            </View>
            <View style={styles.heroCardBottom}>
              <View>
                <Text style={styles.heroMetaLabel}>Total Balance</Text>
                <Text style={styles.heroAmount}>{formatCurrency(featuredCard?.groupTotal ?? totalBalance)}</Text>
              </View>
              <View style={styles.managePill}>
                <Text style={styles.managePillText}>Manage</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionEyebrow}>Active Groups</Text>
          {activeGroups.length > 3 ? (
            <Pressable onPress={() => navigation.navigate('Groups')}>
              <Text style={styles.linkText}>See All</Text>
            </Pressable>
          ) : null}
        </View>
        {activeGroups.length === 0 ? (
          <SectionCard>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Ionicons name="people-outline" size={32} color={palette.muted} style={{ marginBottom: 8 }} />
              <Text style={[styles.listTitle, { marginBottom: 4, textAlign: 'center' }]}>No active groups</Text>
              <Text style={[styles.bodyText, { textAlign: 'center', marginBottom: 12 }]}>Create a group to start splitting bills</Text>
              <AppButton label="Create Group" onPress={() => navigation.navigate('CreateGroup')} />
            </View>
          </SectionCard>
        ) : (
          activeGroups.slice(0, 3).map((group, idx) => {
            const groupCard = virtualCards.find((c) => c.groupId === group.id);
            const groupBalance = groupCard?.groupTotal ?? 0;
            const color = GROUP_COLORS[idx % GROUP_COLORS.length];
            return (
              <Pressable key={group.id} onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })} style={styles.webListCard}>
                <View style={[styles.groupIconBlock, { backgroundColor: color }]}>
                  <Ionicons name="people" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{group.name}</Text>
                  <Text style={styles.caption}>{group.memberCount} members</Text>
                </View>
                <View style={styles.rowCenter}>
                  <Text style={styles.listAmount}>{formatCurrency(groupBalance)}</Text>
                  <Feather name="chevron-right" size={16} color={palette.muted} />
                </View>
              </Pressable>
            );
          })
        )}

        {recentGroups.length > 0 ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionEyebrow}>Recent Groups</Text>
              <Pressable onPress={() => navigation.navigate('Groups')}>
                <Text style={styles.linkText}>See All</Text>
              </Pressable>
            </View>
            {recentGroups.slice(0, 3).map((group, idx) => {
              const allGroupsIdx = groups.indexOf(group);
              const color = GROUP_COLORS[(allGroupsIdx >= 0 ? allGroupsIdx : idx) % GROUP_COLORS.length];
              return (
                <Pressable key={group.id} onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })} style={[styles.webListCard, { opacity: 0.8 }]}>
                  <View style={[styles.groupIconBlock, { backgroundColor: color }]}>
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.md, backgroundColor: 'rgba(0,0,0,0.3)' }} />
                    <Ionicons name="people" size={20} color="#fff" style={{ position: 'relative', zIndex: 1 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{group.name}</Text>
                    <Text style={styles.caption}>{group.memberCount} members · Settled</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={palette.muted} />
                </Pressable>
              );
            })}
          </>
        ) : null}

        {localInvites?.length ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionEyebrow}>Pending Invites</Text>
            </View>
            {localInvites.map((invite: LocalInviteNotification) => (
              <View key={invite.token} style={[styles.webListCard, { flexDirection: 'column', gap: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.groupIconBlock, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name="people" size={20} color={palette.primaryStrong} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{invite.groupName ?? 'Group Invitation'}</Text>
                    {invite.inviterName ? (
                      <Text style={styles.caption}>Invited by {invite.inviterName}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={{ flex: 1, backgroundColor: palette.success, borderRadius: radii.lg, paddingVertical: 10, alignItems: 'center' }}
                    onPress={async () => {
                      try {
                        await api.invites.accept(invite.token);
                        await refreshBootstrap();
                      } catch {}
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, backgroundColor: palette.cardMuted, borderRadius: radii.lg, paddingVertical: 10, alignItems: 'center' }}
                    onPress={async () => {
                      try {
                        await api.invites.decline(invite.token);
                      } catch {}
                    }}
                  >
                    <Text style={{ color: palette.foreground, fontWeight: '600', fontSize: 14 }}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </Page>
      <BottomNavigationBar
        currentPage="home"
        onNavigate={(page) => {
          if (page === 'home') navigation.navigate('Home');
          if (page === 'groups') navigation.navigate('Groups');
          if (page === 'activity') navigation.navigate('Activity');
          if (page === 'createGroup') navigation.navigate('CreateGroup');
        }}
        onProfilePress={() => setShowProfileSheet(true)}
      />
      <ProfileSheet
        visible={showProfileSheet}
        userName={user?.name}
        userEmail={user?.email}
        onClose={() => setShowProfileSheet(false)}
        onGoAccount={() => navigation.navigate('Account')}
        onGoSettings={() => navigation.navigate('Settings')}
        onGoWallet={() => navigation.navigate('Wallet')}
      />
    </>
  );
}

function GroupsScreen({ navigation }: any) {
  const { user, groups, virtualCards, refreshBootstrap } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'recent'>('active');
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void refreshBootstrap().catch(() => undefined);
    }, [refreshBootstrap]),
  );
  const activeGroups = groups.filter((group) => !group.lastSettledAt || Date.now() - new Date(group.lastSettledAt).getTime() < 15 * 60 * 1000);
  const recentGroups = groups.filter((group) => !!group.lastSettledAt && !activeGroups.some((item) => item.id === group.id));
  const displayGroups = (activeTab === 'active' ? activeGroups : recentGroups).filter((group) =>
    group.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  return (
    <>
      <Page
        title="Groups"
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={() => navigation.navigate('CreateGroup')} style={styles.roundIconButton}>
            <Feather name="plus" size={18} color={palette.foreground} />
          </Pressable>
        }
      >
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={palette.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search groups..."
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
          />
        </View>
        <SegmentedControl
          options={[
            { value: 'active', label: `Active (${activeGroups.length})` },
            { value: 'recent', label: `Recent (${recentGroups.length})` },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
        {displayGroups.length === 0 ? (
          <SectionCard>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Ionicons name={activeTab === 'active' ? 'people-outline' : 'archive-outline'} size={32} color={palette.muted} style={{ marginBottom: 8 }} />
              <Text style={[styles.cardTitle, { textAlign: 'center' }]}>
                {searchQuery ? 'No groups found' : activeTab === 'active' ? 'No active groups' : 'No recent groups'}
              </Text>
              <Text style={[styles.bodyText, { textAlign: 'center' }]}>
                {searchQuery
                  ? `No groups match "${searchQuery}".`
                  : activeTab === 'active'
                    ? 'Create a group to start splitting bills.'
                    : 'Recently settled groups will appear here.'}
              </Text>
              {!searchQuery && activeTab === 'active' ? (
                <AppButton label="Create Group" onPress={() => navigation.navigate('CreateGroup')} />
              ) : null}
            </View>
          </SectionCard>
        ) : (
          <>
            {displayGroups.map((group) => {
              const allIdx = groups.indexOf(group);
              const color = GROUP_COLORS[(allIdx >= 0 ? allIdx : 0) % GROUP_COLORS.length];
              const isRecent = activeTab === 'recent';
              const groupCard = virtualCards.find((c) => c.groupId === group.id);
              const groupBalance = groupCard?.groupTotal ?? 0;
              return (
                <Pressable key={group.id} onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })} style={styles.webListCard}>
                  <View style={[styles.groupIconBlock, { backgroundColor: color }]}>
                    {isRecent ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.md, backgroundColor: 'rgba(0,0,0,0.3)' }} /> : null}
                    <Ionicons name="people" size={20} color="#fff" style={isRecent ? { position: 'relative', zIndex: 1 } : undefined} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{group.name}</Text>
                    <Text style={styles.caption}>
                      {isRecent ? `${group.memberCount} members · Settled` : `${group.memberCount} members`}
                    </Text>
                  </View>
                  <View style={styles.rowCenter}>
                    <Text style={styles.listAmount}>{isRecent ? '' : formatCurrency(groupBalance)}</Text>
                    {isRecent ? <Text style={[styles.caption, { marginRight: 4 }]}>balance</Text> : null}
                    <Feather name="chevron-right" size={16} color={palette.muted} />
                  </View>
                </Pressable>
              );
            })}
            {activeTab === 'active' ? (
              <AppButton label="Create New Group" onPress={() => navigation.navigate('CreateGroup')} style={{ marginTop: 12 }} />
            ) : null}
          </>
        )}
      </Page>
      <BottomNavigationBar
        currentPage="groups"
        onNavigate={(page) => {
          if (page === 'home') navigation.navigate('Home');
          if (page === 'groups') navigation.navigate('Groups');
          if (page === 'activity') navigation.navigate('Activity');
          if (page === 'createGroup') navigation.navigate('CreateGroup');
        }}
        onProfilePress={() => setShowProfileSheet(true)}
      />
      <ProfileSheet
        visible={showProfileSheet}
        userName={user?.name}
        userEmail={user?.email}
        onClose={() => setShowProfileSheet(false)}
        onGoAccount={() => navigation.navigate('Account')}
        onGoSettings={() => navigation.navigate('Settings')}
        onGoWallet={() => navigation.navigate('Wallet')}
      />
    </>
  );
}

function ActivityScreen({ navigation }: any) {
  const { user } = useAuth();
  const socket = useSocketState();
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const activityQuery = useQuery({
    queryKey: ['activity', user?.id, socket.activityChangedAt],
    enabled: !!user,
    queryFn: async () => {
      const [activity, splits] = await Promise.all([
        api.transactions.activity().catch(() => [] as { id: string; group_name: string; amount: number; created_at: string; status: string }[]),
        api.receipts.mySplits().catch(() => [] as { id: string; group_name: string; amount: number; created_at: string; status: string }[]),
      ]);
      const txItems = activity.map((a) => ({
        id: a.id,
        description: a.group_name,
        group: a.group_name,
        amount: a.amount,
        date: a.created_at,
        type: 'paid' as const,
      }));
      const splitItems = splits.map((s) => ({
        id: s.id,
        description: s.group_name,
        group: s.group_name,
        amount: s.amount,
        date: s.created_at,
        type: 'paid' as const,
      }));
      return [...txItems, ...splitItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });
  const transactions = activityQuery.data ?? [];
  return (
    <>
      <Page title="Activity">
        {activityQuery.isLoading ? (
          <LoadingView label="Loading activity..." />
        ) : !transactions.length ? (
          <SectionCard>
            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>No activity yet</Text>
          </SectionCard>
        ) : (
          transactions.map((item) => {
            const isPaid = item.type === 'paid';
            return (
              <View key={item.id} style={styles.webListCard}>
                <View style={[styles.groupIconBlock, { backgroundColor: isPaid ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }]}>
                  <Feather name={isPaid ? 'arrow-up-right' : 'arrow-down-left'} size={20} color={isPaid ? palette.danger : palette.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{item.description}</Text>
                  <Text style={styles.caption}>{item.group} · {formatRelativeTime(item.date)}</Text>
                </View>
                <Text style={[styles.listAmount, { color: isPaid ? palette.danger : palette.success, fontWeight: '700', fontSize: 16 }]}>
                  {isPaid ? '-' : '+'}{formatCurrency(item.amount)}
                </Text>
              </View>
            );
          })
        )}
      </Page>
      <BottomNavigationBar
        currentPage="activity"
        onNavigate={(page) => {
          if (page === 'home') navigation.navigate('Home');
          if (page === 'groups') navigation.navigate('Groups');
          if (page === 'activity') navigation.navigate('Activity');
          if (page === 'createGroup') navigation.navigate('CreateGroup');
        }}
        onProfilePress={() => setShowProfileSheet(true)}
      />
      <ProfileSheet
        visible={showProfileSheet}
        userName={user?.name}
        userEmail={user?.email}
        onClose={() => setShowProfileSheet(false)}
        onGoAccount={() => navigation.navigate('Account')}
        onGoSettings={() => navigation.navigate('Settings')}
        onGoWallet={() => navigation.navigate('Wallet')}
      />
    </>
  );
}

function NotificationsScreen({
  navigation,
  localInvites,
  onRemoveLocalInvite,
}: {
  navigation: any;
  localInvites: LocalInviteNotification[];
  onRemoveLocalInvite: (token: string) => Promise<void>;
}) {
  const { user, refreshBootstrap } = useAuth();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications', user?.id, localInvites.map((item) => item.token).join(',')],
    enabled: !!user,
    queryFn: async () => {
      const server = await api.users.notifications().catch(() => [] as AppNotification[]);
      const local: AppNotification[] = localInvites.map((item) => ({
        id: `local:${item.token}`,
        type: 'invite',
        title: 'Group Invitation',
        message: `Join ${item.groupName ?? 'this group'}`,
        createdAt: item.createdAt,
        groupName: item.groupName,
        inviteToken: item.token,
        source: 'local',
      }));
      return [...local, ...server].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const acceptInvite = useMutation({
    mutationFn: async (token: string) => {
      try {
        await api.invites.accept(token);
      } catch (err) {
        const error = err as Error & { code?: string };
        if (error.code === 'PAYMENT_METHOD_REQUIRED') {
          throw error;
        }
        await api.groups.joinByToken(token);
      }
      await onRemoveLocalInvite(token);
      await refreshBootstrap();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const declineInvite = useMutation({
    mutationFn: async (token: string) => {
      await api.invites.decline(token).catch(() => api.groups.joinPreview(token));
      await onRemoveLocalInvite(token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const allNotifications = notificationsQuery.data ?? [];
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const markRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const markAllRead = () => {
    const newSet = new Set(readIds);
    notifications.forEach((n) => newSet.add(n.id));
    setReadIds(newSet);
  };

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const notifications = allNotifications.filter((n) => !dismissedIds.has(n.id));
  const unreadCount = notifications.filter((n) => !(n as any).read && !readIds.has(n.id)).length;

  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const clearAll = () => {
    const ids = new Set(dismissedIds);
    notifications.filter((n) => n.type !== 'invite').forEach((n) => ids.add(n.id));
    setDismissedIds(ids);
  };

  const iconBgForType = (type: string) => {
    switch (type) {
      case 'invite': return 'rgba(34,197,94,0.12)';
      case 'receipt': return 'rgba(249,115,22,0.1)';
      case 'payment': return 'rgba(16,185,129,0.1)';
      default: return 'rgba(99,102,241,0.1)';
    }
  };

  return (
    <Page
      title="Notifications"
      onBack={() => navigation.goBack()}
      right={
        unreadCount > 0 ? (
          <Pressable onPress={markAllRead}>
            <Text style={[styles.linkText, { fontSize: 13 }]}>Mark All Read</Text>
          </Pressable>
        ) : undefined
      }
    >
      {unreadCount > 0 ? (
        <Text style={[styles.caption, { marginBottom: 8 }]}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
      ) : null}
      {notificationsQuery.isLoading ? (
        <LoadingView label="Loading notifications..." />
      ) : !notifications.length ? (
        <SectionCard>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Ionicons name="notifications-outline" size={32} color={palette.muted} style={{ marginBottom: 8 }} />
            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>No notifications</Text>
          </View>
        </SectionCard>
      ) : (
        <>
          {notifications.map((notification) => {
            const isUnread = !(notification as any).read && !readIds.has(notification.id);
            return (
              <Pressable
                key={notification.id}
                onPress={() => {
                  markRead(notification.id);
                  if (notification.inviteToken) navigation.navigate('AcceptInvite', { token: notification.inviteToken });
                  else if (notification.groupId) navigation.navigate('GroupDetail', { groupId: notification.groupId });
                }}
                style={[styles.notificationCard, isUnread ? { borderColor: palette.primaryStrong, borderWidth: 1 } : undefined]}
              >
                <View style={styles.notificationLeading}>
                  <View style={[styles.notificationIconWrap, { backgroundColor: iconBgForType(notification.type) }]}>
                    <Ionicons
                      name={
                        notification.type === 'invite'
                          ? 'person-add-outline'
                          : notification.type === 'receipt'
                            ? 'receipt-outline'
                            : notification.type === 'payment'
                              ? 'checkmark-done-outline'
                              : 'people-outline'
                      }
                      size={18}
                      color={palette.foreground}
                    />
                  </View>
                  <Text style={styles.notificationTime}>{formatRelativeTime(notification.createdAt)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.cardTitle, { flex: 1 }]}>{notification.title}</Text>
                    {isUnread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primaryStrong }} /> : null}
                    {notification.type !== 'invite' ? (
                      <Pressable onPress={() => dismissNotification(notification.id)} hitSlop={8}>
                        <Ionicons name="close" size={16} color={palette.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.bodyText}>{notification.message}</Text>
                  {notification.type === 'invite' && notification.inviteToken ? (
                    <View style={styles.inlineButtonRow}>
                      <AppButton
                        label="Accept"
                        onPress={async () => {
                          try {
                            await acceptInvite.mutateAsync(notification.inviteToken as string);
                            navigation.navigate('Home');
                          } catch (err) {
                            const error = err as Error & { code?: string };
                            if (error.code === 'PAYMENT_METHOD_REQUIRED') navigation.navigate('Account');
                            else Alert.alert('Unable to join', error.message);
                          }
                        }}
                      />
                      <AppButton label="Decline" onPress={() => declineInvite.mutate(notification.inviteToken as string)} kind="secondary" />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          {notifications.some((n) => n.type !== 'invite') ? (
            <AppButton label="Clear All Notifications" kind="secondary" onPress={clearAll} style={{ marginTop: 12 }} />
          ) : null}
        </>
      )}
    </Page>
  );
}

function AccountScreen({ navigation, route }: any) {
  const { user, setUser, logout, refreshBootstrap } = useAuth();
  const [linking, setLinking] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempName, setTempName] = useState(user?.name ?? '');
  const [tempPhone, setTempPhone] = useState(user?.phone ?? '');
  const notice = route?.params?.notice as string | undefined;

  const handleSaveName = async () => {
    const newName = tempName.trim();
    if (!newName) return;
    setIsEditingName(false);
    try {
      const updated = await api.users.updateProfile({ name: newName });
      setUser({ id: updated.id, email: updated.email, name: updated.name });
    } catch {}
  };

  const handleSavePhone = async () => {
    const newPhone = tempPhone.trim();
    setIsEditingPhone(false);
    try {
      await api.users.updateProfile({ phone: newPhone });
      await refreshBootstrap();
    } catch {}
  };

  return (
    <Page title="Account" onBack={() => navigation.goBack()}>
      {notice ? (
        <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)', borderRadius: radii.xl, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
          <Text style={{ color: palette.foreground, fontSize: 14 }}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.accountHero}>
        <View style={styles.accountAvatar}>
          <Ionicons name="person" size={34} color={palette.foreground} />
        </View>
        <Text style={[styles.linkText, { marginTop: 4 }]}>Change Photo</Text>
      </View>

      <Text style={[styles.sectionEyebrow, { marginBottom: 8 }]}>Personal Information</Text>

      <View style={[styles.card, shadows.card, { marginBottom: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-outline" size={20} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption}>Full Name</Text>
            {isEditingName ? (
              <TextInput
                value={tempName}
                onChangeText={setTempName}
                style={[styles.input, { marginTop: 4, marginBottom: 0 }]}
                autoFocus
              />
            ) : (
              <Text style={styles.listTitle}>{user?.name || 'Not set'}</Text>
            )}
          </View>
          {isEditingName ? (
            <Pressable onPress={handleSaveName}><Ionicons name="checkmark" size={20} color={palette.primaryStrong} /></Pressable>
          ) : (
            <Pressable onPress={() => { setIsEditingName(true); setTempName(user?.name ?? ''); }}><Feather name="edit-2" size={18} color={palette.primaryStrong} /></Pressable>
          )}
        </View>
      </View>

      <View style={[styles.card, shadows.card, { marginBottom: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="mail-outline" size={20} color={palette.primaryStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption}>Email</Text>
            <Text style={styles.listTitle}>{user?.email || 'Not set'}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, shadows.card, { marginBottom: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="call-outline" size={20} color={palette.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption}>Phone Number</Text>
            {isEditingPhone ? (
              <TextInput
                value={tempPhone}
                onChangeText={setTempPhone}
                style={[styles.input, { marginTop: 4, marginBottom: 0 }]}
                autoFocus
                placeholder="+1 (555) 123-4567"
                placeholderTextColor={palette.muted}
              />
            ) : (
              <Text style={styles.listTitle}>{user?.phone || 'Not set'}</Text>
            )}
          </View>
          {isEditingPhone ? (
            <Pressable onPress={handleSavePhone}><Ionicons name="checkmark" size={20} color={palette.primaryStrong} /></Pressable>
          ) : (
            <Pressable onPress={() => { setIsEditingPhone(true); setTempPhone(user?.phone ?? ''); }}><Feather name="edit-2" size={18} color={palette.primaryStrong} /></Pressable>
          )}
        </View>
      </View>

      <Text style={[styles.sectionEyebrow, { marginBottom: 8 }]}>Bank Account</Text>
      {user?.bank_linked ? (
        <View style={[styles.card, shadows.card, { marginBottom: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: radii.lg, backgroundColor: palette.cardMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="business-outline" size={24} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listTitle, { fontWeight: '700' }]}>Bank Account Linked</Text>
              <Text style={styles.caption}>Connected</Text>
            </View>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={16} color={palette.success} />
            </View>
          </View>
        </View>
      ) : (
        <AppButton
          label={linking ? 'Connecting...' : 'Link Bank Account'}
          onPress={async () => {
            setLinking(true);
            try {
              try {
                await launchPlaidFlow(async () => {
                  await refreshBootstrap();
                });
              } catch {
                await api.users.linkBank();
                await refreshBootstrap();
              }
            } catch (err) {
              Alert.alert('Unable to link bank', err instanceof Error ? err.message : 'Something went wrong');
            } finally {
              setLinking(false);
            }
          }}
          disabled={linking}
        />
      )}
      <View style={[styles.card, shadows.card, { marginTop: 12, backgroundColor: palette.cardMuted }]}>
        <Text style={styles.caption}>Your bank account must be linked to create groups and join payment sessions.</Text>
      </View>

      {user?.paymentMethods?.length ? (
        <>
          <Text style={[styles.sectionEyebrow, { marginBottom: 8, marginTop: 20 }]}>Payment Methods</Text>
          {user.paymentMethods.map((method) => (
            <View key={method.id} style={[styles.card, shadows.card, { marginBottom: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.cardMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="card-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{method.brand ?? method.type} •••• {method.last_four}</Text>
                  <Text style={styles.caption}>{method.type}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      ) : null}
    </Page>
  );
}

function SettingsScreen({ navigation }: any) {
  const { logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const SettingsRow = ({ icon, iconBg, label, sub, onPress, danger }: { icon: string; iconBg: string; label: string; sub: string; onPress: () => void; danger?: boolean }) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={20} color={danger ? palette.danger : palette.primaryStrong} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.listTitle, danger ? { color: palette.danger } : undefined]}>{label}</Text>
        <Text style={styles.caption}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={palette.muted} />
    </Pressable>
  );

  return (
    <Page title="Settings" onBack={() => navigation.goBack()}>
      <Text style={[styles.sectionEyebrow, { marginBottom: 8 }]}>Account</Text>
      <SectionCard style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
        <SettingsRow icon="diamond-outline" iconBg="rgba(34,197,94,0.12)" label="Tabby Pro" sub="Unlock premium features" onPress={() => {}} />
      </SectionCard>

      <Text style={[styles.sectionEyebrow, { marginBottom: 8, marginTop: 20 }]}>Appearance</Text>
      <SectionCard style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
        <SettingsRow icon="color-palette-outline" iconBg="rgba(34,197,94,0.12)" label="Theme" sub="Customize app appearance" onPress={() => {}} />
      </SectionCard>

      <Text style={[styles.sectionEyebrow, { marginBottom: 8, marginTop: 20 }]}>Preferences</Text>
      <SectionCard style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
        <SettingsRow icon="notifications-outline" iconBg="rgba(34,197,94,0.12)" label="Notifications" sub="Manage notification settings" onPress={() => {}} />
        <View style={{ height: 1, backgroundColor: palette.border }} />
        <SettingsRow icon="lock-closed-outline" iconBg="rgba(16,185,129,0.1)" label="Privacy & Security" sub="Manage your privacy" onPress={() => {}} />
      </SectionCard>

      <Text style={[styles.sectionEyebrow, { marginBottom: 8, marginTop: 20 }]}>Support</Text>
      <SectionCard style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
        <SettingsRow icon="help-circle-outline" iconBg="rgba(34,197,94,0.12)" label="Help & Support" sub="Get help with your account" onPress={() => {}} />
      </SectionCard>

      <Text style={[styles.sectionEyebrow, { marginBottom: 8, marginTop: 20, color: palette.danger }]}>Danger Zone</Text>
      <SectionCard style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
        <SettingsRow icon="trash-outline" iconBg="rgba(239,68,68,0.1)" label="Delete Account" sub="Permanently delete your account" onPress={() => setShowDeleteModal(true)} danger />
        <View style={{ height: 1, backgroundColor: palette.border }} />
        <SettingsRow icon="log-out-outline" iconBg="rgba(239,68,68,0.1)" label="Log Out" sub="Sign out of your account" onPress={logout} danger />
      </SectionCard>

      {showDeleteModal ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
          <Pressable onPress={() => setShowDeleteModal(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
          <View style={{ position: 'absolute', top: '35%', left: 20, right: 20, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: radii.xl, padding: 24, zIndex: 51 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Ionicons name="trash-outline" size={24} color={palette.danger} />
            </View>
            <Text style={[styles.cardTitle, { textAlign: 'center', fontSize: 20, marginBottom: 8 }]}>Delete Account?</Text>
            <Text style={[styles.bodyText, { textAlign: 'center', marginBottom: 20 }]}>This action cannot be undone. All your data will be permanently deleted.</Text>
            <AppButton label="Yes, Delete Account" kind="danger" onPress={() => setShowDeleteModal(false)} />
            <AppButton label="Cancel" kind="secondary" onPress={() => setShowDeleteModal(false)} />
          </View>
        </View>
      ) : null}
    </Page>
  );
}

function WalletScreen({ navigation }: any) {
  const { virtualCards } = useAuth();
  return (
    <Page title="Virtual Wallet" onBack={() => navigation.goBack()}>
      <Text style={[styles.caption, { marginBottom: 16 }]}>Manage your group payment cards</Text>
      {!virtualCards.length ? (
        <SectionCard>
          <Text style={styles.cardTitle}>No cards yet</Text>
          <Text style={styles.bodyText}>Your virtual group cards will appear once you create or join a group.</Text>
        </SectionCard>
      ) : (
        virtualCards.map((card) => (
          <Pressable key={card.groupId} onPress={() => navigation.navigate('CardDetails', { groupId: card.groupId })} style={[styles.heroCard, { marginBottom: spacing.md }]}>
            <View style={styles.heroCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{card.groupName}</Text>
                <Text style={styles.heroCardNumber}>•••• •••• •••• {card.cardLastFour ?? '----'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm }}>
                  <Text style={{ color: palette.success, fontSize: 11, fontWeight: '600' }}>Active</Text>
                </View>
                <Ionicons name="card-outline" size={22} color={palette.secondaryText} />
              </View>
            </View>
            <View style={styles.heroCardBottom}>
              <View>
                <Text style={styles.heroMetaLabel}>Balance</Text>
                <Text style={styles.heroAmount}>{formatCurrency(card.groupTotal)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.linkText, { fontSize: 13 }]}>View Details</Text>
                <Feather name="chevron-right" size={18} color={palette.muted} />
              </View>
            </View>
          </Pressable>
        ))
      )}
      <AppButton label="Create New Group Card" onPress={() => navigation.navigate('CreateGroup')} kind="secondary" style={{ marginTop: 8 }} />
    </Page>
  );
}

function CreateGroupScreen({ navigation }: any) {
  const { refreshBootstrap } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const createGroupMutation = useMutation({
    mutationFn: () => api.groups.create(groupName.trim(), memberEmails.length ? memberEmails : undefined),
    onSuccess: async (result) => {
      setCreatedGroupId(result.id);
      setInviteLink(`tabby://join/${result.inviteToken}`);
      await refreshBootstrap();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    },
  });

  if (createdGroupId) {
    return (
      <Page title="Group Created" onBack={() => navigation.navigate('Groups')}>
        <View style={styles.successHero}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={40} color={palette.background} />
          </View>
          <Text style={styles.heroTitle}>Group Created!</Text>
          <Text style={styles.bodyText}>Share this link with your friends to join the group.</Text>
        </View>
        <SectionCard>
          <Text style={styles.cardTitle}>Invite Link</Text>
          <View style={styles.linkBox}>
            <Text style={styles.bodyText}>{inviteLink}</Text>
          </View>
          <View style={styles.inlineButtonRow}>
            <AppButton label="Copy" onPress={async () => { await Clipboard.setStringAsync(inviteLink); }} />
            <AppButton
              label="Share"
              onPress={async () => {
                try {
                  await RNShare.share({ message: `Join my group on Tabby! ${inviteLink}`, url: inviteLink });
                } catch {
                  await Clipboard.setStringAsync(inviteLink);
                  Alert.alert('Link copied', 'Paste it anywhere you want to share it.');
                }
              }}
              kind="secondary"
            />
          </View>
        </SectionCard>
        <AppButton label="Go to Group" onPress={() => navigation.replace('GroupDetail', { groupId: createdGroupId })} />
        <AppButton label="View All Groups" onPress={() => navigation.navigate('MainTabs', { screen: 'Groups' })} kind="secondary" />
      </Page>
    );
  }

  return (
    <Page title="Create Group" onBack={() => navigation.goBack()}>
      <Field label="Group Name" value={groupName} onChangeText={setGroupName} placeholder="e.g., Dinner Club" />
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Add Members</Text>
        <View style={styles.addRow}>
          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="Enter email address"
            placeholderTextColor={palette.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, styles.addRowInput]}
          />
          <Pressable
            onPress={() => {
              if (!emailInput.trim()) return;
              setMemberEmails((current) => [...new Set([...current, emailInput.trim().toLowerCase()])]);
              setEmailInput('');
            }}
            style={styles.addMemberButton}
          >
            <Ionicons name="person-add-outline" size={20} color={palette.background} />
          </Pressable>
        </View>
      </View>
      {memberEmails.length ? (
        <View style={styles.memberListWrap}>
          {memberEmails.map((email, index) => (
            <View key={email} style={[styles.memberRow, index !== memberEmails.length - 1 ? styles.memberRowBorder : null]}>
              <Text style={styles.listTitle}>{email}</Text>
              <Pressable onPress={() => setMemberEmails((current) => current.filter((item) => item !== email))} style={styles.smallIconButton}>
                <Ionicons name="close" size={16} color={palette.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <SectionCard>
        <Text style={styles.bodyText}>Members will receive an invitation to join this group. A virtual card will be created for shared payments.</Text>
      </SectionCard>
      <AppButton
        label={createGroupMutation.isPending ? 'Creating...' : 'Create Group & Generate Card'}
        onPress={() => createGroupMutation.mutate()}
        disabled={!groupName.trim() || createGroupMutation.isPending}
      />
    </Page>
  );
}

function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string };
  const { user, refreshBootstrap } = useAuth();
  const socket = useSocketState();
  const queryClient = useQueryClient();
  const [tipPercentage, setTipPercentage] = useState(15);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMembersDropdown, setShowMembersDropdown] = useState(false);
  const [membersDropdownAnchor, setMembersDropdownAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [localSplitMode, setLocalSplitMode] = useState<'even' | 'item'>('item');
  const [splitToggleWidth, setSplitToggleWidth] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHostRef = useRef(false);
  const membersTriggerRef = useRef<View | null>(null);
  const membersDropdownAnim = useRef(new Animated.Value(0)).current;
  const splitToggleAnim = useRef(new Animated.Value(0)).current;

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api.groups.get(groupId),
  });
  const receiptsQuery = useQuery({
    queryKey: ['receipts', groupId],
    queryFn: () => api.receipts.list(groupId),
  });

  useEffect(() => {
    if (socket.lastGroupUpdatedId === groupId || socket.groupsChangedAt) {
      void groupQuery.refetch();
      void receiptsQuery.refetch();
    }
  }, [groupId, groupQuery, receiptsQuery, socket.groupsChangedAt, socket.lastGroupUpdatedAt, socket.lastGroupUpdatedId]);

  const group = groupQuery.data;
  const receipts = receiptsQuery.data ?? [];
  const HOST_PENDING_STATUSES = ['pending', 'NEEDS_REVIEW', 'UPLOADED'];
  const ITEM_SPLIT_READY_STATUSES = ['pending', 'NEEDS_REVIEW', 'UPLOADED', 'DONE'];
  const latestPendingReceipt = receipts.find((receipt) => HOST_PENDING_STATUSES.includes(receipt.status));
  const receiptForItemSplit = receipts.find(
    (receipt) => ITEM_SPLIT_READY_STATUSES.includes(receipt.status) || (receipt.status === 'completed' && !receipt.transaction_id),
  );
  const receiptReadyForMemberSelection = !!receiptForItemSplit && ['DONE', 'completed'].includes(receiptForItemSplit.status);
  const hasReceiptForItemSplit = !!receiptForItemSplit;
  const latestCompletedReceipt = receipts.find((receipt) => receipt.status === 'completed' && receipt.total != null);
  const latestItemSplitReceiptId = receiptForItemSplit?.id ?? group?.pendingItemSplit?.receiptId ?? (latestCompletedReceipt?.id ?? '');
  const baseTip = group?.pendingItemSplit?.draftTipPercentage ?? group?.draftTipPercentage ?? 15;
  useEffect(() => {
    setTipPercentage(baseTip);
  }, [baseTip]);

  const isHost = group?.created_by === user?.id;
  isHostRef.current = !!isHost;
  const serverSplitMode = (group?.splitModePreference ?? 'item') as 'even' | 'item';
  const splitMode = localSplitMode;
  const memberCount = Math.max(group?.members.length ?? 1, 1);
  const evenSplitBase = latestCompletedReceipt?.total ? Number(latestCompletedReceipt.total) / memberCount : 0;
  const itemSplitBase = group?.pendingItemSplit?.myAmount ?? 0;
  const displayedBase = splitMode === 'item' ? itemSplitBase : evenSplitBase;
  const displayedTotal = displayedBase * (1 + tipPercentage / 100);
  const memberCountSafe = Math.max(group?.members.length ?? 1, 1);
  const memberAvatars = (group?.members ?? []).slice(0, 3);
  const remainingMembersCount = Math.max((group?.members.length ?? 0) - 3, 0);
  const isViewOnly = !!group?.lastSettledAt;
  const hasReceipt = receipts.some((r) => r.total != null);
  const hasSelectedItems = !!group?.pendingItemSplit;
  const itemSubtotal = group?.pendingItemSplit?.myAmount ?? 0;
  const completedTotal = latestCompletedReceipt?.total ? Number(latestCompletedReceipt.total) : 0;
  const proportionalTaxShare =
    splitMode === 'item' && group?.pendingItemSplit?.receiptTotal && completedTotal <= 0
      ? Math.max(group.pendingItemSplit.receiptTotal - itemSubtotal, 0) * (itemSubtotal / Math.max(group.pendingItemSplit.receiptTotal, 1))
      : 0;
  const itemTipAmount = (itemSubtotal + proportionalTaxShare) * (tipPercentage / 100);
  const itemTotalWithTip = itemSubtotal + proportionalTaxShare + itemTipAmount;
  const evenTipAmount = completedTotal * (tipPercentage / 100);
  const evenTotalWithTip = completedTotal + evenTipAmount;
  const evenPerMember = evenTotalWithTip / memberCountSafe;
  const recentActivity = receipts
    .filter((receipt) => receipt.total != null)
    .slice(0, 5)
    .map((receipt, index) => ({
      id: receipt.id,
      description: `Receipt ${index + 1}`,
      amount: Number(receipt.total ?? 0),
      date: formatRelativeTime(receipt.created_at),
    }));

  useEffect(() => {
    setLocalSplitMode(serverSplitMode);
  }, [serverSplitMode]);

  useEffect(() => {
    Animated.spring(splitToggleAnim, {
      toValue: splitMode === 'item' ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [splitMode, splitToggleAnim]);

  const queueTipUpdate = useCallback(
    (value: number) => {
      setTipPercentage(value);
      if (!isHostRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void api.groups.updateDraftTip(groupId, value).catch(() => undefined);
      }, 150);
    },
    [groupId],
  );

  const handleDeleteGroup = async () => {
    try {
      await api.groups.deleteGroup(groupId);
      await refreshBootstrap();
      navigation.navigate('MainTabs', { screen: 'Groups' });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await api.groups.leaveGroup(groupId);
      await refreshBootstrap();
      navigation.navigate('MainTabs', { screen: 'Groups' });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to leave group');
    }
  };

  const openMembersDropdown = useCallback(() => {
    membersTriggerRef.current?.measureInWindow((x, y, width, height) => {
      setMembersDropdownAnchor({ x, y, width, height });
      setShowMembersDropdown(true);
      membersDropdownAnim.setValue(0);
      Animated.spring(membersDropdownAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      }).start();
    });
  }, [membersDropdownAnim]);

  const closeMembersDropdown = useCallback(() => {
    Animated.timing(membersDropdownAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowMembersDropdown(false);
      }
    });
  }, [membersDropdownAnim]);

  const toggleMembersDropdown = useCallback(() => {
    if (showMembersDropdown) {
      closeMembersDropdown();
      return;
    }
    openMembersDropdown();
  }, [closeMembersDropdown, openMembersDropdown, showMembersDropdown]);

  const startSettlement = async () => {
    try {
      if (!group) return;
      const transaction =
        splitMode === 'item'
          ? await api.transactions.create(groupId, 'FULL_CONTROL', latestItemSplitReceiptId || undefined)
          : await api.transactions.create(groupId, 'EVEN_SPLIT', latestCompletedReceipt?.id);
      if (splitMode === 'even' && latestCompletedReceipt?.total) {
        await api.transactions.setSubtotal(transaction.id, Number(latestCompletedReceipt.total));
      }
      const tipBase = splitMode === 'item' ? itemSplitBase * memberCount : latestCompletedReceipt?.total ?? 0;
      const tipAmount = tipBase * (tipPercentage / 100);
      await api.transactions.setTip(transaction.id, tipAmount);
      await api.transactions.finalize(transaction.id);
      await refreshBootstrap();
      navigation.navigate('ProcessingPayment', { groupId, transactionId: transaction.id });
    } catch (err) {
      Alert.alert('Unable to start settlement', err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const renderTipSection = () => (
    <SectionCard>
      <View style={styles.tipHeaderRow}>
        <View style={styles.rowCenter}>
          <Text style={styles.tipDollar}>$</Text>
          <Text style={styles.cardTitle}>{isHost ? 'Add Tip' : 'Tip'}</Text>
        </View>
        <Text style={styles.tipPercentBig}>{tipPercentage}%</Text>
      </View>
      {isHost ? (
        <>
          <View style={styles.tipPresetRow}>
            {[10, 15, 18, 20].map((tip) => (
              <Pressable
                key={tip}
                onPress={() => queueTipUpdate(tip)}
                style={[styles.tipPresetButton, tipPercentage === tip ? styles.tipPresetButtonActive : null]}
              >
                <Text style={tipPercentage === tip ? styles.tipPresetTextActive : styles.tipPresetText}>{tip}%</Text>
              </Pressable>
            ))}
          </View>
          <Slider
            minimumValue={0}
            maximumValue={30}
            step={1}
            minimumTrackTintColor={palette.primary}
            maximumTrackTintColor={palette.border}
            thumbTintColor={palette.primaryStrong}
            value={tipPercentage}
            onValueChange={(v) => queueTipUpdate(Math.round(v))}
          />
          <View style={styles.tipScaleRow}>
            <Text style={styles.caption}>0%</Text>
            <Text style={styles.caption}>30%</Text>
          </View>
        </>
      ) : (
        <Text style={styles.bodyText}>Host is setting the tip. Your total updates above.</Text>
      )}
    </SectionCard>
  );

  return (
    <Page
      title={group?.name ?? 'Group'}
      onBack={() => navigation.goBack()}
      right={
        <Pressable onPress={() => setShowMenu(!showMenu)} style={styles.roundIconButton}>
          <Feather name="more-vertical" size={18} color={palette.foreground} />
        </Pressable>
      }
    >
      {showMenu ? (
        <>
          <Pressable onPress={() => setShowMenu(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} />
          <View style={{ position: 'absolute', right: 16, top: 8, width: 220, backgroundColor: palette.card, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, zIndex: 20, overflow: 'hidden' }}>
            {!isHost ? (
              <Pressable onPress={() => { setShowMenu(false); Alert.alert('Leave Group', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: handleLeaveGroup }]); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                <Ionicons name="log-out-outline" size={18} color={palette.warning} />
                <Text style={{ color: palette.warning, fontSize: 14, fontWeight: '500' }}>Leave Group</Text>
              </Pressable>
            ) : null}
            {isHost ? (
              <Pressable onPress={() => { setShowMenu(false); Alert.alert('Delete Group', 'This will permanently delete this group and all its data.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: handleDeleteGroup }]); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
                <Text style={{ color: palette.danger, fontSize: 14, fontWeight: '500' }}>Delete Group</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {!group || receiptsQuery.isLoading ? (
        <LoadingView label="Loading group..." />
      ) : (
        <>
          <View style={styles.groupHeroCard}>
            <View style={styles.groupHeroTop}>
              <View style={styles.groupHeroIconBlock}>
                <Ionicons name="people" size={18} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupHeroTitle}>{group.name}</Text>
                {group.supportCode ? (
                  <Text style={styles.groupSupportCode}>Support Code: {group.supportCode}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.virtualCardStrip}>
              <View style={styles.virtualCardIcon}>
                <Ionicons name="card-outline" size={18} color={palette.secondaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.virtualCardTitle}>Virtual Group Card</Text>
                <Text style={styles.virtualCardNumber}>•••• •••• •••• {group.cardLastFour ?? '----'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.groupStatLabel}>Balance</Text>
                <Text style={styles.groupStatValue}>{formatCurrency(completedTotal || 0)}</Text>
              </View>
            </View>
            {!isViewOnly ? (
              <View
                style={styles.groupSplitToggleWrap}
                onLayout={(event) => {
                  setSplitToggleWidth(event.nativeEvent.layout.width);
                }}
              >
                {splitToggleWidth > 0 ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.groupSplitToggleIndicator,
                      {
                        width: (splitToggleWidth - 9) / 2,
                        transform: [
                          {
                            translateX: splitToggleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, (splitToggleWidth - 9) / 2 + 3],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
                {(['even', 'item'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      if (!isHost) return;
                      setLocalSplitMode(mode);
                      void api.groups.updateSplitModePreference(groupId, mode).then(() => {
                        void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
                      }).catch(() => {
                        setLocalSplitMode(serverSplitMode);
                      });
                    }}
                    style={styles.groupSplitToggleItem}
                  >
                    <Text style={splitMode === mode ? styles.groupSplitToggleTextActive : styles.groupSplitToggleText}>
                      {mode === 'even' ? 'Split Evenly' : 'Item Split'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={[styles.card, shadows.card, styles.membersBarCard]}>
            <View ref={membersTriggerRef} collapsable={false} style={styles.membersTriggerWrap}>
              <Pressable onPress={toggleMembersDropdown} style={[styles.membersTrigger, showMembersDropdown ? styles.membersTriggerActive : null]}>
                <View style={{ flexDirection: 'row' }}>
                  {memberAvatars.map((member, index) => (
                    <View key={member.id} style={[styles.memberAvatarGradient, { marginLeft: index > 0 ? -10 : 0, zIndex: 10 - index, backgroundColor: GROUP_COLORS[index % GROUP_COLORS.length] }]}>
                      <Text style={styles.memberAvatarGradientText}>{member.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                  ))}
                  {remainingMembersCount > 0 ? (
                    <View style={[styles.memberAvatarGradient, styles.memberAvatarOverflow, { marginLeft: -10 }]}>
                      <Text style={styles.memberAvatarGradientText}>+{remainingMembersCount}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{group.members.length} members</Text>
                  <Text style={styles.caption}>in this group</Text>
                </View>
              </Pressable>
            </View>

            {!isViewOnly ? (
              <Pressable onPress={() => setShowInviteSheet(true)} style={styles.membersInviteButton}>
                <Ionicons name="person-add-outline" size={16} color="#F8FAFC" />
                <Text style={styles.membersInviteButtonText}>Invite</Text>
              </Pressable>
            ) : null}
          </View>

          <Modal visible={showMembersDropdown} transparent animationType="none" onRequestClose={closeMembersDropdown}>
            <View style={styles.membersOverlayRoot}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeMembersDropdown} />
              {membersDropdownAnchor ? (
                <Animated.View
                  style={[
                    styles.membersDropdownOverlay,
                    {
                      top: membersDropdownAnchor.y + membersDropdownAnchor.height + 8,
                      left: Math.max(16, Math.min(membersDropdownAnchor.x, Dimensions.get('window').width - 280)),
                      opacity: membersDropdownAnim,
                      transform: [
                        {
                          translateY: membersDropdownAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 0],
                          }),
                        },
                        {
                          scale: membersDropdownAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.98, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.membersDropdownHeader}>
                    <Text style={styles.membersDropdownTitle}>All Members ({group.members.length})</Text>
                  </View>
                  <ScrollView style={styles.membersDropdownScroll} bounces={false} showsVerticalScrollIndicator={false}>
                    {group.members.map((member, memberIndex) => {
                      const isMe = member.id === user?.id;
                      const isMemberCreator = member.id === group.created_by;
                      return (
                        <View key={member.id} style={styles.membersDropdownRow}>
                          <View style={[styles.memberAvatarGradient, { backgroundColor: GROUP_COLORS[memberIndex % GROUP_COLORS.length] }]}>
                            <Text style={styles.memberAvatarGradientText}>{member.name.slice(0, 2).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.listTitle, { fontWeight: '600' }]}>{isMe ? 'You' : member.name}</Text>
                            {isMe ? <Text style={[styles.caption, { fontSize: 12 }]}>You</Text> : null}
                            {isMemberCreator ? <Text style={styles.membersCreatorText}>Group Creator</Text> : null}
                          </View>
                          {isHost && !isMe ? (
                            <Pressable
                              onPress={() => {
                                closeMembersDropdown();
                                Alert.alert('Remove Member', `Remove ${member.name} from this group?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () => {
                                      api.groups.removeMember(groupId, member.id).then(() => groupQuery.refetch()).catch(() => undefined);
                                    },
                                  },
                                ]);
                              }}
                              hitSlop={8}
                            >
                              <Text style={styles.membersRemoveText}>Remove</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              ) : null}
            </View>
          </Modal>

          {isViewOnly && group.lastSettledAllocations?.length ? (
            <SectionCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={24} color={palette.success} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Payment Complete</Text>
                  <Text style={styles.caption}>Everyone has been charged</Text>
                </View>
              </View>
              <Text style={[styles.listTitle, { marginBottom: 4 }]}>What each person paid</Text>
              <Text style={[styles.caption, { marginBottom: 12 }]}>Tip is split by the host's choice; tax is proportional to what you ordered.</Text>
              {group.lastSettledAllocations.map((alloc, allocIndex) => {
                const breakdown = group.lastSettledBreakdown?.[alloc.user_id];
                const items = group.lastSettledItemsPerUser?.[alloc.user_id];
                const itemSubtotal = breakdown?.subtotal ?? items?.reduce((sum, item) => sum + item.price, 0) ?? 0;
                const taxAmount = breakdown?.tax ?? 0;
                const tipAmount = breakdown?.tip ?? 0;
                return (
                  <View
                    key={alloc.user_id}
                    style={{
                      backgroundColor: palette.cardMuted,
                      borderRadius: 18,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: palette.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: `${GROUP_COLORS[allocIndex % GROUP_COLORS.length]}22`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: `${GROUP_COLORS[allocIndex % GROUP_COLORS.length]}55`,
                          }}
                        >
                          <Text style={{ color: palette.foreground, fontSize: 13, fontWeight: '800' }}>
                            {alloc.name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listTitle}>{alloc.name}</Text>
                          <Text style={[styles.caption, { fontSize: 11 }]}>Final split</Text>
                        </View>
                      </View>
                      <Text style={[styles.listAmount, { color: palette.success }]}>{formatCurrency(alloc.amount)}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'Items', value: itemSubtotal },
                        { label: 'Tax', value: taxAmount },
                        { label: 'Tip', value: tipAmount },
                      ].map((stat) => (
                        <View
                          key={stat.label}
                          style={{
                            flex: 1,
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: 12,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <Text style={{ color: palette.muted, fontSize: 10, fontWeight: '700', marginBottom: 2 }}>{stat.label}</Text>
                          <Text style={{ color: palette.foreground, fontSize: 12, fontWeight: '700' }}>{formatCurrency(stat.value)}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.border }}>
                      <Text style={[styles.caption, { marginBottom: 6, fontSize: 11, fontWeight: '600', color: palette.secondaryText }]}>What they got</Text>
                      {items?.length ? (
                        items.map((it, i) => (
                          <View key={i} style={[styles.infoRow, { paddingVertical: 2 }]}>
                            <Text style={[styles.caption, { flex: 1, paddingRight: 10, color: palette.secondaryText }]} numberOfLines={1}>
                              {it.name}
                            </Text>
                            <Text style={[styles.caption, { color: palette.foreground }]}>{formatCurrency(it.price)}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.caption}>No item details available</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </SectionCard>
          ) : null}

          {!isViewOnly ? (!hasReceipt && !hasReceiptForItemSplit ? (
            <SectionCard>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="receipt-outline" size={28} color={palette.primaryStrong} />
              </View>
              <Text style={styles.cardTitle}>{isHost ? 'Add a Receipt' : 'Waiting for Receipt'}</Text>
              <Text style={styles.bodyText}>
                {isHost
                  ? 'Upload your receipt to get started. You can split the bill evenly or by item after uploading.'
                  : 'Only the group host can add a receipt.'}
              </Text>
              {isHost ? (
                <AppButton
                  label="Add Receipt"
                  onPress={() =>
                    navigation.navigate('ReceiptScan', {
                      groupId,
                      returnToGroupAfterUpload: splitMode === 'even',
                    })
                  }
                />
              ) : null}
            </SectionCard>
          ) : splitMode === 'item' && hasReceiptForItemSplit ? (
            hasSelectedItems ? (
              <>
                <SectionCard>
                  <View style={styles.receiptCardHeader}>
                    <View style={[styles.receiptStatusIcon, { backgroundColor: '#3147ff' }]}>
                      <Ionicons name="receipt-outline" size={22} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Items Selected</Text>
                      <Text style={styles.caption}>Your items from receipt</Text>
                    </View>
                    {latestItemSplitReceiptId ? (
                      <Pressable onPress={() => navigation.navigate('ReceiptItems', { groupId, receiptId: latestItemSplitReceiptId })}>
                        <Text style={styles.editLink}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.receiptBreakdownBox}>
                    <View style={styles.infoRow}>
                      <Text style={styles.caption}>Your Items</Text>
                      <Text style={styles.listTitle}>{formatCurrency(itemSubtotal)}</Text>
                    </View>
                    {proportionalTaxShare > 0 ? (
                      <View style={styles.infoRow}>
                        <Text style={styles.caption}>Tax</Text>
                        <Text style={styles.listTitle}>{formatCurrency(proportionalTaxShare)}</Text>
                      </View>
                    ) : null}
                    <View style={styles.infoRow}>
                      <Text style={styles.caption}>Tip ({tipPercentage}%)</Text>
                      <Text style={styles.listTitle}>{formatCurrency(itemTipAmount)}</Text>
                    </View>
                    <View style={[styles.infoRow, styles.receiptBreakdownDivider]}>
                      <Text style={styles.listTitle}>Your Total</Text>
                      <Text style={styles.receiptTotalStrong}>{formatCurrency(itemTotalWithTip)}</Text>
                    </View>
                  </View>
                </SectionCard>
                {renderTipSection()}
                {isHost ? (
                  <AppButton
                    label={`Complete Payment • ${formatCurrency(itemTotalWithTip)}`}
                    onPress={startSettlement}
                    disabled={!latestItemSplitReceiptId}
                  />
                ) : (
                  <Text style={styles.centerMutedText}>Only the group creator can complete payment.</Text>
                )}
              </>
            ) : (
              <SectionCard>
                {!receiptReadyForMemberSelection && !isHost ? (
                  <>
                    <View style={styles.emptyStateIcon}>
                      <Ionicons name="time-outline" size={28} color={palette.warning} />
                    </View>
                    <Text style={styles.cardTitle}>Waiting for host to confirm receipt</Text>
                    <Text style={styles.bodyText}>
                      The host uploaded a receipt and is reviewing the OCR result. You can select your items once they confirm.
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.emptyStateIcon}>
                      <Ionicons name="receipt-outline" size={28} color={palette.primaryStrong} />
                    </View>
                    <Text style={styles.cardTitle}>Select Your Items</Text>
                    <Text style={styles.bodyText}>
                      A receipt has been uploaded. Choose what you ordered to split by item with your group in real time.
                    </Text>
                    <AppButton
                      label="Select Your Items"
                      onPress={() => latestItemSplitReceiptId && navigation.navigate('ReceiptItems', { groupId, receiptId: latestItemSplitReceiptId })}
                      disabled={!latestItemSplitReceiptId}
                    />
                    {isHost && latestPendingReceipt ? (
                      <AppButton
                        label="Review OCR"
                        onPress={() => navigation.navigate('ReceiptItems', { groupId, receiptId: latestPendingReceipt.id })}
                        kind="secondary"
                      />
                    ) : null}
                  </>
                )}
              </SectionCard>
            )
          ) : splitMode === 'even' && hasReceipt ? (
            <>
              <SectionCard>
                <View style={styles.receiptCardHeader}>
                  <View style={[styles.receiptStatusIcon, { backgroundColor: '#2fbf71' }]}>
                    <Ionicons name="receipt-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Receipt Added</Text>
                    <Text style={styles.caption}>Bill will be split evenly</Text>
                  </View>
                  <View style={styles.receiptCheckIcon}>
                    <Ionicons name="checkmark" size={18} color="#0f7a3d" />
                  </View>
                </View>
                <View style={styles.receiptBreakdownBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.caption}>Subtotal</Text>
                    <Text style={styles.listTitle}>{formatCurrency(completedTotal)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.caption}>Tip ({tipPercentage}%)</Text>
                    <Text style={styles.listTitle}>{formatCurrency(evenTipAmount)}</Text>
                  </View>
                  <View style={[styles.infoRow, styles.receiptBreakdownDivider]}>
                    <Text style={styles.listTitle}>Total</Text>
                    <Text style={styles.receiptTotalStrong}>{formatCurrency(evenTotalWithTip)}</Text>
                  </View>
                  <View style={styles.yourShareBox}>
                    <View style={styles.infoRow}>
                      <Text style={styles.listTitle}>Your Share</Text>
                      <Text style={styles.receiptTotalStrong}>{formatCurrency(evenPerMember)}</Text>
                    </View>
                    <Text style={styles.caption}>Split among {memberCountSafe} members</Text>
                  </View>
                </View>
              </SectionCard>
              {renderTipSection()}
              {isHost ? (
                <AppButton
                  label={`Complete Payment • ${formatCurrency(evenPerMember)}`}
                  onPress={startSettlement}
                  disabled={!latestCompletedReceipt?.id}
                />
              ) : (
                <Text style={styles.centerMutedText}>Only the group creator can complete payment.</Text>
              )}
            </>
          ) : (
            <SectionCard>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="receipt-outline" size={28} color={palette.primaryStrong} />
              </View>
              <Text style={styles.cardTitle}>{isHost ? 'Upload a Receipt' : 'Waiting for Receipt'}</Text>
              <Text style={styles.bodyText}>
                {isHost ? 'Upload your receipt to split by item.' : 'Only the group host can add a receipt.'}
              </Text>
              {isHost ? (
                <AppButton
                  label="Add Receipt"
                  onPress={() => navigation.navigate('ReceiptScan', { groupId, returnToGroupAfterUpload: false })}
                />
              ) : null}
            </SectionCard>
          )) : null}

          {recentActivity.length ? (
            <View style={styles.activitySection}>
              <Text style={styles.sectionEyebrow}>Recent Activity</Text>
              {recentActivity.map((transaction) => (
                <View key={transaction.id} style={styles.activityCard}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="receipt-outline" size={18} color="#ef4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{transaction.description}</Text>
                    <Text style={styles.caption}>{transaction.date}</Text>
                  </View>
                  <Text style={styles.activityAmountNegative}>-{formatCurrency(transaction.amount).replace('$', '$')}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Modal visible={showInviteSheet} transparent animationType="slide" onRequestClose={() => setShowInviteSheet(false)}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowInviteSheet(false)}>
              <Pressable style={styles.profileSheet} onPress={() => undefined}>
                <View style={styles.sheetHandle} />
                <View style={styles.profileSheetHeader}>
                  <Text style={styles.profileSheetTitle}>Invite Members</Text>
                  <Pressable onPress={() => setShowInviteSheet(false)} style={styles.smallIconButton}>
                    <Ionicons name="close" size={16} color={palette.foreground} />
                  </Pressable>
                </View>
                <Text style={styles.bodyText}>{group.inviteToken ? `tabby://join/${group.inviteToken}` : 'No invite link yet.'}</Text>
                <View style={styles.linkBox}>
                  <Text style={styles.bodyText}>{group.inviteToken ? `tabby://join/${group.inviteToken}` : 'No invite token yet.'}</Text>
                </View>
                <AppButton
                  label="Copy Invite"
                  onPress={async () => {
                    if (!group.inviteToken) return;
                    await Clipboard.setStringAsync(`tabby://join/${group.inviteToken}`);
                    setShowInviteSheet(false);
                  }}
                />
                <AppButton label="Close" onPress={() => setShowInviteSheet(false)} kind="secondary" />
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </Page>
  );
}

async function pickReceiptSource(kind: 'camera' | 'library' | 'file'): Promise<UploadAsset | null> {
  if (kind === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission is required.');
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.fileName ?? 'receipt.jpg', type: asset.mimeType ?? 'image/jpeg' };
  }
  if (kind === 'library') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Photo library permission is required.');
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.fileName ?? 'receipt.jpg', type: asset.mimeType ?? 'image/jpeg' };
  }
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['image/*', 'application/pdf'] });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' };
}

function ReceiptScanScreen({ route, navigation }: any) {
  const { groupId, returnToGroupAfterUpload } = route.params as { groupId: string; returnToGroupAfterUpload?: boolean };
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'upload' | 'processing'>('upload');
  const [uploading, setUploading] = useState(false);

  const startUpload = async (kind: 'camera' | 'library' | 'file') => {
    setError('');
    try {
      const asset = await pickReceiptSource(kind);
      if (!asset) return;
      setUploading(true);
      const result = await api.receipts.uploadWithProgress(groupId, asset, (percent, nextPhase) => {
        setProgress(percent);
        setPhase(nextPhase);
      });
      if (returnToGroupAfterUpload) {
        navigation.replace('GroupDetail', { groupId });
      } else {
        navigation.replace('ReceiptItems', { groupId, receiptId: result.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Page title="Upload Receipt" onBack={() => navigation.goBack()}>
      <SectionCard>
        <Text style={styles.cardTitle}>{uploading ? (phase === 'upload' ? `Uploading ${progress}%` : 'Processing Receipt...') : 'Choose a Receipt Source'}</Text>
        <Text style={styles.bodyText}>Use the camera, your photo library, or a file to continue the split flow.</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </SectionCard>
      <Pressable onPress={() => startUpload('camera')} style={styles.actionTile} disabled={uploading}>
        <Ionicons name="camera-outline" size={24} color={palette.foreground} />
        <Text style={styles.actionTileTitle}>Take Photo</Text>
        <Text style={styles.actionTileBody}>Capture the receipt with your camera.</Text>
      </Pressable>
      <Pressable onPress={() => startUpload('library')} style={styles.actionTile} disabled={uploading}>
        <Ionicons name="images-outline" size={24} color={palette.foreground} />
        <Text style={styles.actionTileTitle}>Photo Library</Text>
        <Text style={styles.actionTileBody}>Choose an existing image from your photos.</Text>
      </Pressable>
      <Pressable onPress={() => startUpload('file')} style={styles.actionTile} disabled={uploading}>
        <Ionicons name="document-outline" size={24} color={palette.foreground} />
        <Text style={styles.actionTileTitle}>Files</Text>
        <Text style={styles.actionTileBody}>Import a PDF or image file.</Text>
      </Pressable>
    </Page>
  );
}

function ReceiptItemsScreen({ route, navigation }: any) {
  const { groupId, receiptId } = route.params as { groupId: string; receiptId: string };
  const { user } = useAuth();
  const socket = useSocketState();
  const queryClient = useQueryClient();
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [reviewReceipt, setReviewReceipt] = useState<ReceiptReviewDraft | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const receiptQuery = useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: () => api.receipts.get(receiptId),
  });

  useEffect(() => {
    if (socket.lastReceiptClaimsUpdated?.receiptId === receiptId || socket.lastGroupUpdatedId === groupId) {
      void receiptQuery.refetch();
    }
  }, [groupId, receiptId, receiptQuery, socket.lastGroupUpdatedAt, socket.lastGroupUpdatedId, socket.lastReceiptClaimsUpdated]);

  useEffect(() => {
    if (receiptQuery.data?.status === 'NEEDS_REVIEW' && receiptQuery.data.parsed_output) {
      setReviewReceipt({
        merchantName: receiptQuery.data.parsed_output.merchantName,
        receiptDate: receiptQuery.data.parsed_output.receiptDate,
        totals: { ...receiptQuery.data.parsed_output.totals },
        lineItems: receiptQuery.data.parsed_output.lineItems.map((item) => ({ ...item })),
      });
    } else {
      setReviewReceipt(null);
    }
  }, [receiptQuery.data]);

  useEffect(() => {
    if (!selectedMemberId && user?.id) setSelectedMemberId(user.id);
  }, [selectedMemberId, user?.id]);

  useEffect(() => {
    if (receiptQuery.data?.status === 'completed') {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      navigation.replace('GroupDetail', { groupId });
    }
  }, [groupId, navigation, queryClient, receiptQuery.data?.status]);

  const toggleClaim = async (itemId: string) => {
    if (!receiptQuery.data || !user || selectedMemberId !== user.id) return;
    const canSelectItems = user.id === receiptQuery.data.uploaded_by || !['NEEDS_REVIEW', 'UPLOADED'].includes(receiptQuery.data.status);
    if (!canSelectItems) return;
    const current = receiptQuery.data.claims[itemId] ?? [];
    const next = current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id];
    await api.receipts.updateClaims(receiptId, itemId, next);
    await receiptQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
  };

  const addManualItem = async () => {
    const price = Number(manualPrice);
    if (!manualName.trim() || Number.isNaN(price)) return;
    await api.receipts.addItem(receiptId, manualName.trim(), price);
    setManualName('');
    setManualPrice('');
    await receiptQuery.refetch();
  };

  const finalizeReceipt = async () => {
    await api.receipts.complete(receiptId);
    await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    navigation.replace('GroupDetail', { groupId });
  };

  const confirmReviewedReceipt = async () => {
    if (!reviewReceipt) return;
    const validation = validateReceipt(reviewReceipt);
    if (!validation.isValid) {
      Alert.alert('Review required', validation.issues.join('\n'));
      return;
    }
    await api.receipts.confirm(receiptId, reviewReceipt);
    await receiptQuery.refetch();
  };

  if (receiptQuery.isLoading || !receiptQuery.data) {
    return <LoadingView label="Loading receipt..." />;
  }

  const receipt = receiptQuery.data;
  const isUploader = receipt.uploaded_by === user?.id;
  const validation = reviewReceipt ? validateReceipt(reviewReceipt) : null;
  const canSelectItems = isUploader || !['NEEDS_REVIEW', 'UPLOADED'].includes(receipt.status);
  const waitingForHostConfirm = !canSelectItems && !!receipt.uploaded_by && user?.id !== receipt.uploaded_by;
  const myClaimedSubtotal = receipt.items.reduce((sum, item) => {
    const claims = receipt.claims[item.id] ?? [];
    if (!claims.includes(user?.id ?? '')) return sum;
    return sum + item.price / Math.max(claims.length, 1);
  }, 0);
  const itemsSubtotal = receipt.items.reduce((sum, item) => sum + item.price, 0);
  const receiptTotal = receipt.final_snapshot?.totals.total ?? receipt.parsed_output?.totals.total ?? itemsSubtotal;
  const tax = receiptTotal != null && receiptTotal >= itemsSubtotal && itemsSubtotal > 0 ? receiptTotal - itemsSubtotal : 0;
  const taxRatio = itemsSubtotal > 0 ? tax / itemsSubtotal : 0;
  const myTaxShare = myClaimedSubtotal * taxRatio;
  const myClaimedTotal = myClaimedSubtotal + myTaxShare;
  const allItemsSelected = receipt.items.every((item) => (receipt.claims[item.id] ?? []).length > 0);
  const getMemberSubtotal = (memberId: string) =>
    receipt.items.reduce((sum, item) => {
      const claims = receipt.claims[item.id] ?? [];
      if (!claims.includes(memberId)) return sum;
      return sum + item.price / Math.max(claims.length, 1);
    }, 0);

  if (reviewReceipt && isUploader) {
    return (
      <Page title="Review Receipt" onBack={() => navigation.goBack()}>
        <SectionCard>
          <Field
            label="Merchant"
            value={reviewReceipt.merchantName ?? ''}
            onChangeText={(value) => setReviewReceipt((current) => (current ? { ...current, merchantName: value } : current))}
            placeholder="Merchant name"
          />
          <Field
            label="Receipt date"
            value={reviewReceipt.receiptDate ?? ''}
            onChangeText={(value) => setReviewReceipt((current) => (current ? { ...current, receiptDate: value } : current))}
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="Subtotal"
            value={String(reviewReceipt.totals.subtotal ?? '')}
            onChangeText={(value) =>
              setReviewReceipt((current) => (current ? { ...current, totals: { ...current.totals, subtotal: Number(value) || 0 } } : current))
            }
            keyboardType="numeric"
          />
          <Field
            label="Tax"
            value={String(reviewReceipt.totals.tax ?? '')}
            onChangeText={(value) =>
              setReviewReceipt((current) => (current ? { ...current, totals: { ...current.totals, tax: Number(value) || 0 } } : current))
            }
            keyboardType="numeric"
          />
          <Field
            label="Tip"
            value={String(reviewReceipt.totals.tip ?? '')}
            onChangeText={(value) =>
              setReviewReceipt((current) => (current ? { ...current, totals: { ...current.totals, tip: Number(value) || 0 } } : current))
            }
            keyboardType="numeric"
          />
          <Field
            label="Total"
            value={String(reviewReceipt.totals.total ?? '')}
            onChangeText={(value) =>
              setReviewReceipt((current) => (current ? { ...current, totals: { ...current.totals, total: Number(value) || 0 } } : current))
            }
            keyboardType="numeric"
          />
          {reviewReceipt.lineItems.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.subCard}>
              <Field
                label={`Item ${index + 1}`}
                value={item.name}
                onChangeText={(value) =>
                  setReviewReceipt((current) => {
                    if (!current) return current;
                    const lineItems = [...current.lineItems];
                    lineItems[index] = { ...lineItems[index], name: value };
                    return { ...current, lineItems };
                  })
                }
              />
              <Field
                label="Price"
                value={String(item.price)}
                onChangeText={(value) =>
                  setReviewReceipt((current) => {
                    if (!current) return current;
                    const lineItems = [...current.lineItems];
                    lineItems[index] = { ...lineItems[index], price: Number(value) || 0 };
                    return { ...current, lineItems };
                  })
                }
                keyboardType="numeric"
              />
            </View>
          ))}
          {!validation?.isValid ? <Text style={styles.errorText}>{validation?.issues.join(' ')}</Text> : null}
          <View style={styles.rowGap}>
            <AppButton
              label="Retry OCR"
              onPress={async () => {
                await api.receipts.retry(receiptId);
                await receiptQuery.refetch();
              }}
              kind="secondary"
            />
            <AppButton label="Confirm receipt" onPress={confirmReviewedReceipt} />
          </View>
        </SectionCard>
      </Page>
    );
  }

  if (waitingForHostConfirm) {
    return (
      <Page title="Split Items" onBack={() => navigation.goBack()}>
        <SectionCard>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="time-outline" size={28} color={palette.warning} />
          </View>
          <Text style={styles.cardTitle}>Waiting for host to confirm receipt</Text>
          <Text style={styles.bodyText}>The host uploaded a receipt and is reviewing the OCR result. You can select your items once they confirm.</Text>
        </SectionCard>
      </Page>
    );
  }

  return (
    <Page title="Claim Items" onBack={() => navigation.goBack()}>
      <View style={styles.groupHeroCard}>
        <Text style={styles.groupStatLabel}>Receipt</Text>
        <Text style={styles.caption}>{formatCurrency(receiptTotal)}</Text>
        <Text style={styles.selectionPill}>Tap items to claim</Text>
        <View style={styles.memberTabsRow}>
          {receipt.members.map((member, index) => {
            const isSelected = selectedMemberId === member.id;
            const isMe = member.id === user?.id;
            return (
              <Pressable
                key={member.id}
                onPress={() => setSelectedMemberId(member.id)}
                style={[styles.memberTab, isSelected ? styles.memberTabActive : null]}
              >
                <Text style={isSelected ? styles.memberTabTextActive : styles.memberTabText}>
                  {isMe ? 'You' : member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.groupStatLabel}>Your Running Total</Text>
        <Text style={styles.heroAmount}>{formatCurrency(myClaimedTotal)}</Text>
        <Text style={styles.caption}>Includes {formatCurrency(myTaxShare)} tax (proportional)</Text>
      </View>

      {receipt.items.map((item) => {
        const claims = receipt.claims[item.id] ?? [];
        const isMine = claims.includes(user?.id ?? '');
        const claimantNames = claims.map((id) => receipt.members.find((member) => member.id === id)?.name ?? 'Member');
        return (
          <Pressable key={item.id} onPress={() => toggleClaim(item.id)} style={[styles.claimRowCard, isMine ? styles.claimRowCardActive : null]}>
            <View style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.caption}>{claimantNames.length ? claimantNames.join(', ') : 'Unclaimed'}</Text>
              </View>
              <View>
                <Text style={styles.listAmount}>{formatCurrency(item.price)}</Text>
                <Text style={styles.caption}>{isMine ? 'Claimed by you' : selectedMemberId === user?.id ? 'Tap to toggle' : 'Viewing selections'}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      {!showManualEntry ? (
        <Pressable onPress={() => setShowManualEntry(true)} style={styles.outlineWideButton}>
          <Text style={styles.listTitle}>Add Manual Item</Text>
        </Pressable>
      ) : (
        <SectionCard>
          <Text style={styles.cardTitle}>Add Manual Item</Text>
          <Field label="Name" value={manualName} onChangeText={setManualName} placeholder="Extra sauce" />
          <Field label="Price" value={manualPrice} onChangeText={setManualPrice} keyboardType="numeric" placeholder="2.50" />
          <View style={styles.inlineButtonRow}>
            <AppButton label="Cancel" onPress={() => setShowManualEntry(false)} kind="secondary" />
            <AppButton label="Add Item" onPress={addManualItem} />
          </View>
        </SectionCard>
      )}

      {isUploader ? (
        <AppButton
          label="Confirm Selections"
          onPress={() => setShowConfirmation(true)}
          disabled={!allItemsSelected}
        />
      ) : null}

      <Modal visible={showConfirmation} transparent animationType="fade" onRequestClose={() => setShowConfirmation(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setShowConfirmation(false)}>
          <Pressable style={styles.confirmSheet} onPress={() => undefined}>
            <Text style={styles.confirmTitle}>Confirm Item Selections?</Text>
            <Text style={styles.bodyText}>Review each member's selections. You'll add tip and complete payment on the next screen.</Text>
            <View style={styles.confirmTotalsList}>
              {receipt.members.map((member) => {
                const subtotal = getMemberSubtotal(member.id);
                const taxShare = subtotal * taxRatio;
                return (
                  <View key={member.id} style={styles.confirmTotalRow}>
                    <Text style={styles.listTitle}>{member.id === user?.id ? 'You' : member.name}</Text>
                    <Text style={styles.listAmount}>
                      {formatCurrency(subtotal + taxShare)} <Text style={styles.caption}>(incl. {formatCurrency(taxShare)} tax)</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.inlineButtonRow}>
              <AppButton label="Cancel" onPress={() => setShowConfirmation(false)} kind="secondary" />
              <AppButton label="Confirm Selection" onPress={finalizeReceipt} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Page>
  );
}

function ProcessingPaymentScreen({ route, navigation }: any) {
  const { transactionId } = route.params as { groupId: string; transactionId: string };
  const { refreshBootstrap } = useAuth();
  const transactionQuery = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => api.transactions.get(transactionId),
  });

  useEffect(() => {
    let active = true;
    async function settle() {
      try {
        await api.transactions.settle(transactionId);
        await refreshBootstrap();
        if (active) {
          setTimeout(() => navigation.popToTop(), 2000);
        }
      } catch {
        // Ignore if already settled on the backend timer.
      }
    }
    void settle();
    return () => {
      active = false;
    };
  }, [navigation, refreshBootstrap, transactionId]);

  if (!transactionQuery.data) {
    return <LoadingView label="Processing payments..." />;
  }

  const membersById = new Map(transactionQuery.data.members.map((member) => [member.id, member.name]));
  return (
    <Page title="Processing Payment" onBack={() => navigation.goBack()}>
      <View style={styles.successHero}>
        <ActivityIndicator color={palette.foreground} size="large" />
        <Text style={styles.heroTitle}>Processing Payment</Text>
        <Text style={styles.bodyText}>We’re settling the group and updating balances.</Text>
      </View>
      <SectionCard>
        <Text style={styles.cardTitle}>Transaction Total</Text>
        <Text style={styles.heroAmount}>{formatCurrency(transactionQuery.data.total)}</Text>
      </SectionCard>
      <SectionCard>
        <Text style={styles.cardTitle}>Allocations</Text>
        {transactionQuery.data.allocations.map((allocation) => (
          <View key={`${allocation.user_id}-${allocation.amount}`} style={styles.listRow}>
            <Text style={styles.listTitle}>{membersById.get(allocation.user_id) ?? 'Member'}</Text>
            <Text style={styles.listAmount}>{formatCurrency(allocation.amount)}</Text>
          </View>
        ))}
      </SectionCard>
    </Page>
  );
}

function AcceptInviteScreen({
  route,
  navigation,
  onRemoveLocalInvite,
  setPendingInviteToken,
}: {
  route: any;
  navigation: any;
  onRemoveLocalInvite: (token: string) => Promise<void>;
  setPendingInviteToken: (token: string | null) => void;
}) {
  const { token } = route.params as { token: string };
  const { user, refreshBootstrap } = useAuth();
  const inviteQuery = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      try {
        return await api.invites.getByToken(token);
      } catch {
        const preview = await api.groups.joinPreview(token);
        return {
          inviteId: token,
          groupId: '',
          groupName: preview.groupName,
          inviterName: 'Tabby',
          inviteeEmail: '',
          token,
          createdAt: new Date().toISOString(),
        };
      }
    },
  });

  const accept = async () => {
    if (!user) return;
    try {
      try {
        await api.invites.accept(token);
      } catch (err) {
        const error = err as Error & { code?: string };
        if (error.code === 'PAYMENT_METHOD_REQUIRED') {
          navigation.navigate('Account');
          return;
        }
        await api.groups.joinByToken(token);
      }
      await onRemoveLocalInvite(token);
      setPendingInviteToken(null);
      await refreshBootstrap();
      navigation.navigate('Home');
    } catch (err) {
      Alert.alert('Unable to join group', err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const [acceptError, setAcceptError] = useState('');
  const needsBankLink = acceptError.includes('PAYMENT_METHOD_REQUIRED');

  const handleAccept = async () => {
    setAcceptError('');
    try {
      await accept();
    } catch (err) {
      const error = err as Error & { code?: string };
      setAcceptError(error.code === 'PAYMENT_METHOD_REQUIRED' ? 'PAYMENT_METHOD_REQUIRED' : error.message ?? 'Failed to join');
    }
  };

  if (!inviteQuery.data && !inviteQuery.isLoading) {
    return (
      <Page title="Group Invite" onBack={() => navigation.goBack()}>
        <SectionCard>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Ionicons name="alert-circle-outline" size={32} color={palette.danger} style={{ marginBottom: 8 }} />
            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>Invalid or expired invite link.</Text>
          </View>
        </SectionCard>
        <AppButton label="Go Home" onPress={() => navigation.navigate('Home')} />
      </Page>
    );
  }

  return (
    <Page title="Group Invite" onBack={() => navigation.goBack()}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: radii.xl, backgroundColor: palette.cardMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="people" size={28} color={palette.primaryStrong} />
        </View>
        <Text style={[styles.heroTitle, { fontSize: 22, textAlign: 'center' }]}>You're Invited!</Text>
        <Text style={[styles.heroSubtitle, { textAlign: 'center' }]}>
          Join <Text style={{ fontWeight: '700', color: palette.foreground }}>{inviteQuery.data?.groupName ?? 'this group'}</Text>
        </Text>
      </View>

      {acceptError && !needsBankLink ? (
        <View style={[styles.errorBox, { marginBottom: 12 }]}>
          <Text style={styles.errorText}>{acceptError}</Text>
        </View>
      ) : null}

      {needsBankLink ? (
        <AppButton label="Link Bank Account" onPress={() => navigation.navigate('Account', { notice: 'Link your bank account to join this group.' })} style={{ marginBottom: 8 }} />
      ) : null}

      {user ? (
        <AppButton label="Accept Invitation" onPress={handleAccept} />
      ) : null}

      <AppButton
        label="Decline"
        onPress={async () => {
          await api.invites.decline(token).catch(() => undefined);
          await onRemoveLocalInvite(token);
          setPendingInviteToken(null);
          navigation.goBack();
        }}
        kind="secondary"
      />

      <AppButton
        label="Ignore for Now"
        onPress={() => {
          setPendingInviteToken(null);
          navigation.goBack();
        }}
        kind="secondary"
      />

      <Text style={[styles.caption, { textAlign: 'center', marginTop: 20 }]}>
        By accepting, you'll be able to split bills and track expenses with this group.
      </Text>
    </Page>
  );
}

function CardDetailsScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string };
  const { user, virtualCards } = useAuth();
  const card = virtualCards.find((item) => item.groupId === groupId);
  const groupQuery = useQuery({
    queryKey: ['group', groupId, 'card-details'],
    queryFn: () => api.groups.get(groupId),
  });
  const members = groupQuery.data?.members ?? [];

  if (!card && !groupQuery.isLoading) {
    return (
      <Page title="Card Details" onBack={() => navigation.goBack()}>
        <SectionCard>
          <Text style={styles.cardTitle}>No card selected</Text>
          <Text style={styles.bodyText}>This card could not be found.</Text>
        </SectionCard>
      </Page>
    );
  }

  return (
    <Page title="Card Details" onBack={() => navigation.goBack()}>
      {groupQuery.isLoading ? (
        <LoadingView label="Loading card details..." />
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroCardTop}>
              <View>
                <Text style={styles.eyebrow}>Virtual Group Card</Text>
                <Text style={styles.heroCardNumber}>•••• •••• •••• {card?.cardLastFour ?? '----'}</Text>
              </View>
              <Ionicons name="card-outline" size={24} color={palette.secondaryText} />
            </View>
            <View style={styles.cardMetaGrid}>
              <View>
                <Text style={styles.heroMetaLabel}>Expires</Text>
                <Text style={styles.listTitle}>12/26</Text>
              </View>
              <View>
                <Text style={styles.heroMetaLabel}>CVV</Text>
                <Text style={styles.listTitle}>•••</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.appleWalletButton}>
            <Ionicons name="logo-apple" size={24} color="#000000" />
            <Text style={styles.appleWalletText}>Add to Apple Wallet</Text>
          </Pressable>
          <SectionCard>
            <Text style={styles.cardTitle}>Group Balance</Text>
            <Text style={styles.heroAmount}>{formatCurrency(card?.groupTotal ?? 0)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={{ flexDirection: 'row' }}>
                {members.slice(0, 3).map((m, i) => (
                  <View key={m.id} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length], alignItems: 'center', justifyContent: 'center', marginLeft: i > 0 ? -8 : 0, borderWidth: 2, borderColor: palette.card }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.caption}>{members.length} members in group</Text>
            </View>
          </SectionCard>
          <SectionCard>
            <Text style={styles.cardTitle}>Group Members</Text>
            {members.map((member) => (
              <View key={member.id} style={styles.memberCardRow}>
                <View style={styles.memberAvatarSmall}>
                  <Text style={styles.memberAvatarText}>{member.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.listTitle}>{member.id === user?.id ? 'You' : member.name}</Text>
              </View>
            ))}
          </SectionCard>
          <Pressable onPress={() => navigation.navigate('GroupDetail', { groupId })} style={styles.outlineWideButton}>
            <Text style={styles.listTitle}>View Group Details</Text>
            <Feather name="chevron-right" size={18} color={palette.muted} />
          </Pressable>
        </>
      )}
    </Page>
  );
}

function MainTabs({
  localInvites,
}: {
  localInvites: LocalInviteNotification[];
}) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        animation: 'fade',
      }}
    >
      <Tab.Screen name="Home">
        {(props: any) => <HomeScreen {...props} localInvites={localInvites} />}
      </Tab.Screen>
      <Tab.Screen name="Groups" component={GroupsScreen} options={{ tabBarLabel: 'Groups' }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ tabBarLabel: 'Activity' }} />
    </Tab.Navigator>
  );
}

function NavigationShell({
  localInvites,
  pendingInviteToken,
  setPendingInviteToken,
  onRemoveLocalInvite,
}: {
  localInvites: LocalInviteNotification[];
  pendingInviteToken: string | null;
  setPendingInviteToken: (token: string | null) => void;
  onRemoveLocalInvite: (token: string) => Promise<void>;
}) {
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: palette.background,
        card: palette.card,
        text: palette.foreground,
        border: palette.border,
        primary: palette.primaryStrong,
      },
    }),
    [],
  );

  useEffect(() => {
    if (pendingInviteToken && navigationRef.isReady()) {
      navigationRef.navigate('AcceptInvite', { token: pendingInviteToken });
    }
  }, [pendingInviteToken]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
          animation: 'ios_from_right',
          fullScreenGestureEnabled: true,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="MainTabs">
          {() => <MainTabs localInvites={localInvites} />}
        </Stack.Screen>
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        <Stack.Screen name="ReceiptScan" component={ReceiptScanScreen} />
        <Stack.Screen name="ReceiptItems" component={ReceiptItemsScreen} />
        <Stack.Screen name="ProcessingPayment" component={ProcessingPaymentScreen} />
        <Stack.Screen name="Notifications">
          {(props) => <NotificationsScreen {...props} localInvites={localInvites} onRemoveLocalInvite={onRemoveLocalInvite} />}
        </Stack.Screen>
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="CardDetails" component={CardDetailsScreen} />
        <Stack.Screen name="AcceptInvite">
          {(props) => (
            <AcceptInviteScreen
              {...props}
              onRemoveLocalInvite={onRemoveLocalInvite}
              setPendingInviteToken={setPendingInviteToken}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AuthedRoot() {
  const { user, loading } = useAuth();
  const [localInvites, setLocalInvites] = useState<LocalInviteNotification[]>([]);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [inviteLabel, setInviteLabel] = useState<string | undefined>(undefined);

  const refreshLocalInvites = useCallback(async () => {
    const invites = await readLocalInvites();
    setLocalInvites(invites);
  }, []);

  const upsertLocalInvite = useCallback(async (token: string) => {
    const existing = await readLocalInvites();
    if (existing.some((item) => item.token === token)) {
      await refreshLocalInvites();
      return;
    }
    let groupName: string | undefined;
    let inviterName: string | undefined;
    try {
      const preview = await api.groups.joinPreview(token);
      groupName = preview.groupName;
    } catch {}
    try {
      const inviteInfo = await api.invites.getByToken(token);
      inviterName = inviteInfo.inviterName;
    } catch {}
    const next: LocalInviteNotification[] = [{ token, groupName, inviterName, createdAt: new Date().toISOString() }, ...existing];
    await writeLocalInvites(next);
    setInviteLabel(groupName);
    setLocalInvites(next);
  }, [refreshLocalInvites]);

  const removeLocalInvite = useCallback(async (token: string) => {
    const next = (await readLocalInvites()).filter((item) => item.token !== token);
    await writeLocalInvites(next);
    setLocalInvites(next);
  }, []);

  useEffect(() => {
    void refreshLocalInvites();
  }, [refreshLocalInvites]);

  useEffect(() => {
    let mounted = true;
    async function handleInitialUrl() {
      const url = await Linking.getInitialURL();
      const token = parseInviteTokenFromUrl(url);
      if (!token || !mounted) return;
      setPendingInviteToken(token);
      await upsertLocalInvite(token);
    }
    void handleInitialUrl();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = parseInviteTokenFromUrl(url);
      if (!token) return;
      setPendingInviteToken(token);
      void upsertLocalInvite(token);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [upsertLocalInvite]);

  useEffect(() => {
    if (!user) return;
    async function registerPushToken() {
      try {
        const permission = await Notifications.getPermissionsAsync();
        const finalStatus =
          permission.status === 'granted' ? permission.status : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return;
        const token = await Notifications.getExpoPushTokenAsync();
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token.data);
        await api.users.registerDeviceToken(token.data, Platform.OS);
      } catch {
        // Optional push registration should never block app usage.
      }
    }
    void registerPushToken();
  }, [user?.id]);

  if (loading) return <LoadingView />;

  if (!user) {
    return <AuthScreen inviteLabel={inviteLabel} />;
  }

  return (
    <SocketProvider enabled={!!user}>
      {!user.onboardingCompleted ? (
        <OnboardingScreen pendingInviteToken={pendingInviteToken} />
      ) : (
        <NavigationShell
          localInvites={localInvites}
          pendingInviteToken={pendingInviteToken}
          setPendingInviteToken={setPendingInviteToken}
          onRemoveLocalInvite={removeLocalInvite}
        />
      )}
    </SocketProvider>
  );
}

function RootApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthedRoot />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RootApp />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  screenHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  screenTitle: {
    color: palette.foreground,
    fontSize: 28,
    fontWeight: '700',
  },
  pageContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  subCard: {
    backgroundColor: palette.cardMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  button: {
    borderRadius: radii.md,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldWrap: {
    gap: 8,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: palette.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardMuted,
    color: palette.foreground,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  authPage: {
    flex: 1,
    backgroundColor: palette.background,
  },
  authContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  centerHero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  logoEmoji: {
    fontSize: 40,
  },
  heroTitle: {
    color: palette.foreground,
    fontSize: 32,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: palette.secondaryText,
    fontSize: 18,
    fontWeight: '600',
  },
  bodyText: {
    color: palette.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: palette.muted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#331822',
    borderColor: '#5B2233',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.cardMuted,
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: palette.primaryStrong,
  },
  segmentLabel: {
    color: palette.muted,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  authToggle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.border,
  },
  progressBarActive: {
    backgroundColor: palette.primaryStrong,
  },
  rowGap: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 4,
  },
  listTitle: {
    color: palette.foreground,
    fontWeight: '700',
    fontSize: 15,
  },
  listAmount: {
    color: palette.foreground,
    fontWeight: '700',
    fontSize: 16,
  },
  cardTitle: {
    color: palette.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  pillText: {
    color: palette.primary,
    fontWeight: '700',
  },
  loadingPage: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingBadge: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderWidth: 1,
  },
  loadingLabel: {
    color: palette.secondaryText,
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkText: {
    color: palette.foreground,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallIconButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionEyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  linkText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 24,
    padding: 24,
    gap: 24,
    marginBottom: spacing.lg,
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroCardNumber: {
    color: palette.foreground,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  heroCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroMetaLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroAmount: {
    color: palette.foreground,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  managePill: {
    backgroundColor: palette.cardMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  managePillText: {
    color: palette.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  successHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBox: {
    backgroundColor: palette.cardMuted,
    borderRadius: 16,
    padding: 14,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addRowInput: {
    flex: 1,
    marginBottom: 0,
  },
  addMemberButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: palette.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberListWrap: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  groupHeroCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  groupHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  groupHeroIconBlock: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeroTitle: {
    color: palette.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupSupportCode: {
    color: palette.secondaryText,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  groupHeroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  
  virtualCardStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  virtualCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  virtualCardTitle: {
    color: palette.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  virtualCardNumber: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  groupSplitToggleWrap: {
    flexDirection: 'row',
    backgroundColor: palette.cardMuted,
    borderRadius: 14,
    padding: 3,
    gap: 3,
    position: 'relative',
  },
  groupSplitToggleIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
    backgroundColor: palette.primaryStrong,
  },
  groupSplitToggleItem: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  groupSplitToggleText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  groupSplitToggleTextActive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  groupStatBox: {
    flex: 1,
    backgroundColor: palette.cardMuted,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  groupStatLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupStatValue: {
    color: palette.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  memberCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  membersSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  membersBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  membersTriggerWrap: {
    flex: 1,
    marginRight: 14,
  },
  membersTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  membersTriggerActive: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  membersInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  membersInviteButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  membersAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EC4899',
    borderWidth: 2,
    borderColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarOverflow: {
    backgroundColor: palette.cardMuted,
    marginLeft: -12,
  },
  memberAvatarGradientText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  membersOverlayRoot: {
    flex: 1,
  },
  membersDropdownOverlay: {
    position: 'absolute',
    width: 264,
    backgroundColor: 'rgba(17,17,19,0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },
  membersDropdownHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  membersDropdownTitle: {
    color: palette.foreground,
    fontSize: 15,
    fontWeight: '800',
  },
  membersDropdownScroll: {
    maxHeight: 220,
  },
  membersDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  membersCreatorText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  membersRemoveText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  memberAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: palette.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  tipPercentText: {
    color: palette.foreground,
    fontSize: 28,
    fontWeight: '800',
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(141,153,174,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  receiptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  receiptStatusIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCheckIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e6f7ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLink: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
  },
  receiptBreakdownBox: {
    backgroundColor: '#131313',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  receiptBreakdownDivider: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10,
    marginTop: 4,
  },
  receiptTotalStrong: {
    color: palette.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  yourShareBox: {
    backgroundColor: 'rgba(141,153,174,0.12)',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tipDollar: {
    color: '#f59e0b',
    fontSize: 26,
    fontWeight: '700',
  },
  tipPercentBig: {
    color: palette.primaryStrong,
    fontSize: 24,
    fontWeight: '800',
  },
  tipPresetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  tipPresetButton: {
    flex: 1,
    backgroundColor: palette.cardMuted,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipPresetButtonActive: {
    backgroundColor: palette.primaryStrong,
  },
  tipPresetButtonDisabled: {
    opacity: 0.7,
  },
  tipPresetText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  tipPresetTextActive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tipScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  centerMutedText: {
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 14,
  },
  actionGrid: {
    gap: 12,
  },
  webListCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupIconBlock: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationDotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  searchWrap: {
    backgroundColor: palette.cardMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: palette.foreground,
    fontSize: 15,
    padding: 0,
  },
  actionTile: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  actionTileDisabled: {
    opacity: 0.55,
  },
  actionTileTitle: {
    color: palette.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  actionTileBody: {
    color: palette.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: palette.cardMuted,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedItemActive: {
    backgroundColor: palette.card,
  },
  segmentedItemText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedItemTextActive: {
    color: palette.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9,9,11,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  bottomNavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 56,
    paddingVertical: 2,
  },
  navItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  addNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primaryStrong,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  navLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  navLabelActive: {
    color: palette.foreground,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.foreground,
    marginTop: 2,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  profileSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  profileSheetTitle: {
    color: palette.foreground,
    fontSize: 17,
    fontWeight: '700',
  },
  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: palette.foreground,
    fontSize: 20,
    fontWeight: '700',
  },
  profileEmail: {
    color: palette.muted,
    fontSize: 14,
  },
  profileSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  profileSheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(100,116,139,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSheetRowTitle: {
    color: palette.foreground,
    fontSize: 17,
    fontWeight: '600',
  },
  profileSheetRowSubtitle: {
    color: palette.muted,
    fontSize: 13,
  },
  notificationCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  notificationLeading: {
    alignItems: 'center',
    gap: 8,
  },
  notificationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTime: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  inlineButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  claimRowCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 16,
  },
  claimRowCardActive: {
    borderColor: palette.primaryStrong,
    backgroundColor: '#111317',
  },
  selectionPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.14)',
    color: '#5bd68e',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  memberTabsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  memberTab: {
    backgroundColor: palette.cardMuted,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberTabActive: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  memberTabText: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  memberTabTextActive: {
    color: '#5bd68e',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmSheet: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    gap: 16,
  },
  confirmTitle: {
    color: palette.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  confirmTotalsList: {
    gap: 12,
  },
  confirmTotalRow: {
    backgroundColor: '#151515',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  activitySection: {
    marginTop: 8,
    gap: 10,
  },
  activityCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2a1414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAmountNegative: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '800',
  },
  accountHero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.lg,
  },
  accountAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: palette.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    color: palette.foreground,
    fontSize: 24,
    fontWeight: '800',
  },
  accountSubtext: {
    color: palette.muted,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillText: {
    color: palette.success,
    fontSize: 12,
    fontWeight: '700',
  },
  cardMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  appleWalletButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  appleWalletText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  outlineWideButton: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
