import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
import { loginApi, refreshTokenApi, logoutApi, changePasswordApi } from "./api";


// function self invoice to check if the user is already sigin or not
// the Function must be in the top of the file to excute the check loged user
const storedAuth = (() => {
  try {
    const raw = localStorage.getItem("auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const initialState = {
  currentUser: storedAuth?.user ?? null,
  accessToken: storedAuth?.accessToken ?? null,
  refreshToken: storedAuth?.refreshToken ?? null,
  isRefreshing: false,
  isLoginPending: false,
  loginError: null,
};

export const loginThunk = createAsyncThunk(
  "identity/login",
  async (payload, { rejectWithValue }) => {
    try {
      return await loginApi(payload.email, payload.password);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Sign in failed. Check your email and password."));
    }
  },
);

export const refreshTokenThunk = createAsyncThunk(
  "identity/refreshToken",
  async (_, { getState, rejectWithValue }) => {
    const state = getState();
    const refreshToken = state.identity.refreshToken;

    if (!refreshToken) {
      return rejectWithValue("No refresh token available");
    }

    try {
      return await refreshTokenApi(refreshToken);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Session expired"));
    }
  },
);

export const logoutThunk = createAsyncThunk(
  "identity/logout",
  async (_, { dispatch }) => {
    try {
      await logoutApi();
    } catch (error) {
      // Even if server logout fails, we clear local state
      console.warn("Server logout failed:", error);
    } finally {
      dispatch(logout());
    }
  },
);

export const changePasswordThunk = createAsyncThunk(
  "identity/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      return await changePasswordApi(payload.currentPassword, payload.newPassword);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to change password"));
    }
  },
);

const identitySlice = createSlice({
  name: "identity",
  initialState,
  reducers: {
    logout: (state) => {
      state.currentUser = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isRefreshing = false;
      state.isLoginPending = false;
      state.loginError = null;
      try {
        localStorage.removeItem("auth");
      } catch {
        // ignore
      }
    },
    setTokens: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      // Update localStorage
      const authData = {
        user: state.currentUser,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      };
      localStorage.setItem("auth", JSON.stringify(authData));
    },
    clearLoginError: (state) => {
      state.loginError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoginPending = true;
        state.loginError = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.currentUser = action.payload.user;
        state.isRefreshing = false;
        state.isLoginPending = false;
        state.loginError = null;
        localStorage.setItem(
          "auth",
          JSON.stringify({
            user: action.payload.user,
            accessToken: action.payload.accessToken,
            refreshToken: action.payload.refreshToken,
          }),
        );
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoginPending = false;
        state.loginError = action.payload || action.error.message;
      })
      .addCase(refreshTokenThunk.pending, (state) => {
        state.isRefreshing = true;
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isRefreshing = false;
        // Update localStorage
        const authData = {
          user: state.currentUser,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        };
        localStorage.setItem("auth", JSON.stringify(authData));
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        // Token refresh failed, logout user
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isRefreshing = false;
        try {
          localStorage.removeItem("auth");
        } catch {
          // ignore
        }
      })
      .addCase(changePasswordThunk.fulfilled, (state) => {
        // Password changed successfully, but user needs to login again
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isRefreshing = false;
        try {
          localStorage.removeItem("auth");
        } catch {
          // ignore
        }
      });
  },
});

export const identityReducer = identitySlice.reducer;
export const { logout, setTokens, clearLoginError } = identitySlice.actions;
