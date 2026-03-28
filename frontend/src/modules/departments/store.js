import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
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
};

export const fetchDepartmentsThunk = createAsyncThunk(
  "departments/fetch",
  async () => getDepartmentsApi(),
);

export const createDepartmentThunk = createAsyncThunk(
  "departments/create",
  async (payload) =>
    createDepartmentApi({ ...payload, id: createId() }),
);

export const updateDepartmentThunk = createAsyncThunk(
  "departments/update",
  async (payload) => updateDepartmentApi(payload),
);

export const deleteDepartmentThunk = createAsyncThunk(
  "departments/delete",
  async (departmentId) => deleteDepartmentApi(departmentId),
);

const departmentsSlice = createSlice({
  name: "departments",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchDepartmentsThunk.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchDepartmentsThunk.fulfilled, (state, action) => {
      state.items = action.payload;
      state.isLoading = false;
    });
    builder.addCase(fetchDepartmentsThunk.rejected, (state) => {
      state.isLoading = false;
    });
    builder.addCase(createDepartmentThunk.fulfilled, (state, action) => {
      state.items.unshift(action.payload);
    });
    builder.addCase(updateDepartmentThunk.fulfilled, (state, action) => {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    });
    builder.addCase(deleteDepartmentThunk.fulfilled, (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.meta.arg);
    });
  },
});

export const departmentsReducer = departmentsSlice.reducer;
