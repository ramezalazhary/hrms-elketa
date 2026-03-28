import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { createId } from "@/shared/utils/id";
import {
  createEmployeeApi,
  getEmployeesApi,
  deleteEmployeeApi,
  updateEmployeeApi,
} from "./api";

const initialState = {
  items: [],
  isLoading: false,
};

export const fetchEmployeesThunk = createAsyncThunk(
  "employees/fetch",
  async () => getEmployeesApi(),
);

export const createEmployeeThunk = createAsyncThunk(
  "employees/create",
  async (payload) =>
    createEmployeeApi({ ...payload, id: createId() }),
);

export const deleteEmployeeThunk = createAsyncThunk(
  "employees/delete",
  async (employeeId) => deleteEmployeeApi(employeeId),
);

export const updateEmployeeThunk = createAsyncThunk(
  "employees/update",
  async (payload) => updateEmployeeApi(payload),
);

const employeesSlice = createSlice({
  name: "employees",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchEmployeesThunk.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchEmployeesThunk.fulfilled, (state, action) => {
      state.items = action.payload;
      state.isLoading = false;
    });
    builder.addCase(fetchEmployeesThunk.rejected, (state) => {
      state.isLoading = false;
    });
    builder.addCase(createEmployeeThunk.fulfilled, (state, action) => {
      state.items.unshift(action.payload);
    });
    builder.addCase(updateEmployeeThunk.fulfilled, (state, action) => {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    });
    builder.addCase(deleteEmployeeThunk.fulfilled, (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.meta.arg);
    });
  },
});

export const employeesReducer = employeesSlice.reducer;
