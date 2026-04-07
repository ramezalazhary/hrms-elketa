import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
import {
  getPositionsApi,
  getPositionApi,
  createPositionApi,
  updatePositionApi,
  deletePositionApi,
} from "./api";

const initialState = {
  items: [],
  selectedPosition: null,
  isLoading: false,
  error: null,
};

export const fetchPositionsThunk = createAsyncThunk(
  "positions/fetch",
  async (filters = {}, { rejectWithValue }) => {
    try {
      return await getPositionsApi(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load positions"));
    }
  },
);

export const fetchPositionThunk = createAsyncThunk(
  "positions/fetchOne",
  async (positionId, { rejectWithValue }) => {
    try {
      return await getPositionApi(positionId);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load position"));
    }
  },
);

export const createPositionThunk = createAsyncThunk(
  "positions/create",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createPositionApi(payload);
      return response.position || response;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to create position"));
    }
  },
);

export const updatePositionThunk = createAsyncThunk(
  "positions/update",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await updatePositionApi(payload);
      return response.position || response;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update position"));
    }
  },
);

export const deletePositionThunk = createAsyncThunk(
  "positions/delete",
  async (positionId, { rejectWithValue }) => {
    try {
      await deletePositionApi(positionId);
      return positionId;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to delete position"));
    }
  },
);

const positionsSlice = createSlice({
  name: "positions",
  initialState,
  reducers: {
    clearSelectedPosition: (state) => {
      state.selectedPosition = null;
    },
    clearPositionsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPositionsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPositionsThunk.fulfilled, (state, action) => {
        state.items = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchPositionsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchPositionThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchPositionThunk.fulfilled, (state, action) => {
        state.selectedPosition = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchPositionThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(createPositionThunk.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(createPositionThunk.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updatePositionThunk.fulfilled, (state, action) => {
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.selectedPosition = action.payload;
      })
      .addCase(updatePositionThunk.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deletePositionThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(deletePositionThunk.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearSelectedPosition, clearPositionsError } = positionsSlice.actions;
export const positionsReducer = positionsSlice.reducer;
