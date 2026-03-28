import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  loginApi,
  refreshTokenApi,
  logoutApi,
  changePasswordApi,
} from "./api";

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
};

export const loginThunk = createAsyncThunk(
  "identity/login",
  async (payload) => {
    console.log("request data:", payload);
    return await loginApi(payload.email, payload.password);
  },
);

export const refreshTokenThunk = createAsyncThunk(
  "identity/refreshToken",
  async (_, { getState }) => {
    const state = getState();
    const refreshToken = state.identity.refreshToken;

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    return refreshTokenApi(refreshToken);
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
  async (payload) =>
    changePasswordApi(payload.currentPassword, payload.newPassword),
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.currentUser = action.payload.user;
        state.isRefreshing = false;
        localStorage.setItem(
          "auth",
          JSON.stringify({
            user: action.payload.user,
            accessToken: action.payload.accessToken,
            refreshToken: action.payload.refreshToken,
          }),
        );
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
export const { logout, setTokens } = identitySlice.actions;
