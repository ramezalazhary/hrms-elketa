import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
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
  async (filters = {}) => getPositionsApi(filters),
);

export const fetchPositionThunk = createAsyncThunk(
  "positions/fetchOne",
  async (positionId) => getPositionApi(positionId),
);

export const createPositionThunk = createAsyncThunk(
  "positions/create",
  async (payload) => {
    const response = await createPositionApi(payload);
    return response.position || response;
  },
);

export const updatePositionThunk = createAsyncThunk(
  "positions/update",
  async (payload) => {
    const response = await updatePositionApi(payload);
    return response.position || response;
  },
);

export const deletePositionThunk = createAsyncThunk(
  "positions/delete",
  async (positionId) => deletePositionApi(positionId),
);

const positionsSlice = createSlice({
  name: "positions",
  initialState,
  reducers: {
    clearSelectedPosition: (state) => {
      state.selectedPosition = null;
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
        state.error = action.error.message;
      })
      .addCase(fetchPositionThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchPositionThunk.fulfilled, (state, action) => {
        state.selectedPosition = action.payload;
        state.isLoading = false;
      })
      .addCase(createPositionThunk.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updatePositionThunk.fulfilled, (state, action) => {
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
        state.selectedPosition = action.payload;
      })
      .addCase(deletePositionThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.meta.arg);
      });
  },
});

export const { clearSelectedPosition } = positionsSlice.actions;
export const positionsReducer = positionsSlice.reducer;
