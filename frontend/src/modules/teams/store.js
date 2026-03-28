import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  getTeamsApi,
  getTeamApi,
  createTeamApi,
  updateTeamApi,
  deleteTeamApi,
} from "./api";

const initialState = {
  items: [],
  selectedTeam: null,
  isLoading: false,
  error: null,
};

export const fetchTeamsThunk = createAsyncThunk(
  "teams/fetch",
  async (filters = {}) => getTeamsApi(filters),
);

export const fetchTeamThunk = createAsyncThunk(
  "teams/fetchOne",
  async (teamId) => getTeamApi(teamId),
);

export const createTeamThunk = createAsyncThunk(
  "teams/create",
  async (payload) => {
    const response = await createTeamApi(payload);
    return response.team || response;
  },
);

export const updateTeamThunk = createAsyncThunk(
  "teams/update",
  async (payload) => {
    const response = await updateTeamApi(payload);
    return response.team || response;
  },
);

export const deleteTeamThunk = createAsyncThunk(
  "teams/delete",
  async (teamId) => deleteTeamApi(teamId),
);

const teamsSlice = createSlice({
  name: "teams",
  initialState,
  reducers: {
    clearSelectedTeam: (state) => {
      state.selectedTeam = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeamsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamsThunk.fulfilled, (state, action) => {
        state.items = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchTeamsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      })
      .addCase(fetchTeamThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTeamThunk.fulfilled, (state, action) => {
        state.selectedTeam = action.payload;
        state.isLoading = false;
      })
      .addCase(createTeamThunk.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateTeamThunk.fulfilled, (state, action) => {
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.selectedTeam = action.payload;
      })
      .addCase(deleteTeamThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.meta.arg);
      });
  },
});

export const { clearSelectedTeam } = teamsSlice.actions;
export const teamsReducer = teamsSlice.reducer;
