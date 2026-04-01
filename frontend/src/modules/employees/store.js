import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  createEmployeeApi,
  getEmployeesApi,
  deleteEmployeeApi,
  updateEmployeeApi,
  processSalaryIncreaseApi,
} from "./api";

const initialState = {
  items: [],
  isLoading: false,
};

export const fetchEmployeesThunk = createAsyncThunk(
  "employees/fetch",
  async (params) => getEmployeesApi(params),
);

export const createEmployeeThunk = createAsyncThunk(
  "employees/create",
  async (payload) => createEmployeeApi(payload),
);

export const deleteEmployeeThunk = createAsyncThunk(
  "employees/delete",
  async (employeeId) => deleteEmployeeApi(employeeId),
);

export const updateEmployeeThunk = createAsyncThunk(
  "employees/update",
  async (payload) => updateEmployeeApi(payload),
);

export const processSalaryIncreaseThunk = createAsyncThunk(
  "employees/processIncrease",
  async (payload) => processSalaryIncreaseApi(payload),
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
      const data = action.payload;
      const emp = data?.employee ?? data;
      if (emp && (emp.id ?? emp._id)) {
        state.items.unshift(emp);
      }
    });
    builder.addCase(updateEmployeeThunk.fulfilled, (state, action) => {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    });
    builder.addCase(processSalaryIncreaseThunk.fulfilled, (state, action) => {
      // Backend returns { message, employee, nextIncreaseDate } or just employee
      const emp = action.payload.employee || action.payload;
      state.items = state.items.map((item) =>
        item.id === emp.id ? emp : item,
      );
    });
    builder.addCase(deleteEmployeeThunk.fulfilled, (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.meta.arg);
    });
  },
});

export const employeesReducer = employeesSlice.reducer;
