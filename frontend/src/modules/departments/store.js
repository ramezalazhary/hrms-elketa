import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
import { createId } from "@/shared/utils/id";
import {
  createDepartmentApi,
  getDepartmentsApi,
  updateDepartmentApi,
  deleteDepartmentApi,
} from "./api";

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

export const fetchDepartmentsThunk = createAsyncThunk(
  "departments/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await getDepartmentsApi();
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load departments"));
    }
  },
);

export const createDepartmentThunk = createAsyncThunk(
  "departments/create",
  async (payload, { rejectWithValue }) => {
    try {
      return await createDepartmentApi({ ...payload, id: createId() });
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to create department"));
    }
  },
);

export const updateDepartmentThunk = createAsyncThunk(
  "departments/update",
  async (payload, { rejectWithValue }) => {
    try {
      return await updateDepartmentApi(payload);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update department"));
    }
  },
);

export const deleteDepartmentThunk = createAsyncThunk(
  "departments/delete",
  async (departmentId, { rejectWithValue }) => {
    try {
      await deleteDepartmentApi(departmentId);
      return departmentId;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to delete department"));
    }
  },
);

const departmentsSlice = createSlice({
  name: "departments",
  initialState,
  reducers: {
    clearDepartmentsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchDepartmentsThunk.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchDepartmentsThunk.fulfilled, (state, action) => {
      state.items = action.payload;
      state.isLoading = false;
    });
    builder.addCase(fetchDepartmentsThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || action.error.message;
    });
    builder.addCase(createDepartmentThunk.fulfilled, (state, action) => {
      state.items.unshift(action.payload);
    });
    builder.addCase(createDepartmentThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
    builder.addCase(updateDepartmentThunk.fulfilled, (state, action) => {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    });
    builder.addCase(updateDepartmentThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
    builder.addCase(deleteDepartmentThunk.fulfilled, (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    });
    builder.addCase(deleteDepartmentThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
  },
});

export const { clearDepartmentsError } = departmentsSlice.actions;
export const departmentsReducer = departmentsSlice.reducer;
