import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
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
  async (filters = {}, { rejectWithValue }) => {
    try {
      return await getTeamsApi(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load teams"));
    }
  },
);

export const fetchTeamThunk = createAsyncThunk(
  "teams/fetchOne",
  async (teamId, { rejectWithValue }) => {
    try {
      return await getTeamApi(teamId);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load team"));
    }
  },
);

export const createTeamThunk = createAsyncThunk(
  "teams/create",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createTeamApi(payload);
      return response.team || response;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to create team"));
    }
  },
);

export const updateTeamThunk = createAsyncThunk(
  "teams/update",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await updateTeamApi(payload);
      return response.team || response;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update team"));
    }
  },
);

export const deleteTeamThunk = createAsyncThunk(
  "teams/delete",
  async (teamId, { rejectWithValue }) => {
    try {
      await deleteTeamApi(teamId);
      return teamId;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to delete team"));
    }
  },
);

const teamsSlice = createSlice({
  name: "teams",
  initialState,
  reducers: {
    clearSelectedTeam: (state) => {
      state.selectedTeam = null;
    },
    clearTeamsError: (state) => {
      state.error = null;
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
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchTeamThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTeamThunk.fulfilled, (state, action) => {
        state.selectedTeam = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchTeamThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(createTeamThunk.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(createTeamThunk.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateTeamThunk.fulfilled, (state, action) => {
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.selectedTeam = action.payload;
      })
      .addCase(updateTeamThunk.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteTeamThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(deleteTeamThunk.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearSelectedTeam, clearTeamsError } = teamsSlice.actions;
export const teamsReducer = teamsSlice.reducer;
