import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
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
  error: null,
};

export const fetchEmployeesThunk = createAsyncThunk(
  "employees/fetch",
  async (params, { rejectWithValue }) => {
    try {
      return await getEmployeesApi(params);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load employees"));
    }
  },
);

export const createEmployeeThunk = createAsyncThunk(
  "employees/create",
  async (payload, { rejectWithValue }) => {
    try {
      return await createEmployeeApi(payload);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to create employee"));
    }
  },
);

export const deleteEmployeeThunk = createAsyncThunk(
  "employees/delete",
  async (employeeId, { rejectWithValue }) => {
    try {
      await deleteEmployeeApi(employeeId);
      return employeeId;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to delete employee"));
    }
  },
);

export const updateEmployeeThunk = createAsyncThunk(
  "employees/update",
  async (payload, { rejectWithValue }) => {
    try {
      return await updateEmployeeApi(payload);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update employee"));
    }
  },
);

export const processSalaryIncreaseThunk = createAsyncThunk(
  "employees/processIncrease",
  async (payload, { rejectWithValue }) => {
    try {
      return await processSalaryIncreaseApi(payload);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to process salary increase"));
    }
  },
);

const employeesSlice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    clearEmployeesError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchEmployeesThunk.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchEmployeesThunk.fulfilled, (state, action) => {
      state.items = action.payload;
      state.isLoading = false;
    });
    builder.addCase(fetchEmployeesThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || action.error.message;
    });
    builder.addCase(createEmployeeThunk.fulfilled, (state, action) => {
      const data = action.payload;
      const emp = data?.employee ?? data;
      if (emp && (emp.id ?? emp._id)) {
        state.items.unshift(emp);
      }
    });
    builder.addCase(createEmployeeThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
    builder.addCase(updateEmployeeThunk.fulfilled, (state, action) => {
      state.items = state.items.map((item) =>
        item.id === action.payload.id ? action.payload : item,
      );
    });
    builder.addCase(updateEmployeeThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
    builder.addCase(processSalaryIncreaseThunk.fulfilled, (state, action) => {
      // Backend returns { message, employee, nextIncreaseDate } or just employee
      const emp = action.payload.employee || action.payload;
      state.items = state.items.map((item) =>
        item.id === emp.id ? emp : item,
      );
    });
    builder.addCase(processSalaryIncreaseThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
    builder.addCase(deleteEmployeeThunk.fulfilled, (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    });
    builder.addCase(deleteEmployeeThunk.rejected, (state, action) => {
      state.error = action.payload || action.error.message;
    });
  },
});

export const { clearEmployeesError } = employeesSlice.actions;
export const employeesReducer = employeesSlice.reducer;
