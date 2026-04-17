import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
import { 
  getAttendanceApi, 
  importAttendanceApi, 
  createAttendanceApi, 
  updateAttendanceApi, 
  updateAttendanceDeductionSourceApi,
  updateAttendanceRestDayWorkApi,
  deleteAttendanceApi,
  deleteAttendanceBulkApi,
  getMonthlyReportApi,
} from "./api";

export const fetchAttendanceThunk = createAsyncThunk(
  "attendance/fetch",
  async (params, { rejectWithValue }) => {
    try {
      return await getAttendanceApi(params);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load attendance"));
    }
  },
);

export const createAttendanceThunk = createAsyncThunk(
  "attendance/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createAttendanceApi(data);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to create attendance record"));
    }
  },
);

export const updateAttendanceThunk = createAsyncThunk(
  "attendance/update",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await updateAttendanceApi(id, data);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update attendance record"));
    }
  },
);

export const deleteAttendanceThunk = createAsyncThunk(
  "attendance/delete",
  async (id, { rejectWithValue }) => {
    try {
      return await deleteAttendanceApi(id);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to delete attendance record"));
    }
  },
);

export const updateAttendanceDeductionSourceThunk = createAsyncThunk(
  "attendance/updateDeductionSource",
  async ({ id, deductionSource, deductionValueType, deductionValue }, { rejectWithValue }) => {
    try {
      return await updateAttendanceDeductionSourceApi(id, {
        deductionSource,
        deductionValueType,
        deductionValue,
      });
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update deduction source"));
    }
  },
);

export const updateAttendanceRestDayWorkThunk = createAsyncThunk(
  "attendance/updateRestDayWork",
  async ({ id, approved }, { rejectWithValue }) => {
    try {
      return await updateAttendanceRestDayWorkApi(id, { approved });
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to update rest-day work approval"));
    }
  },
);

export const bulkDeleteAttendanceThunk = createAsyncThunk(
  "attendance/bulkDelete",
  async (ids, { rejectWithValue }) => {
    try {
      return await deleteAttendanceBulkApi(ids);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to delete attendance records"));
    }
  },
);

export const importAttendanceThunk = createAsyncThunk(
  "attendance/import",
  async ({ file, overwrite }, { rejectWithValue }) => {
    try {
      return await importAttendanceApi(file, overwrite);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to import attendance"));
    }
  },
);

export const fetchMonthlyReportThunk = createAsyncThunk(
  "attendance/monthlyReport",
  async (params, { rejectWithValue }) => {
    try {
      return await getMonthlyReportApi(params);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to load monthly report"));
    }
  },
);

const initialState = {
  items: [],
  isLoading: false,
  error: null,
  monthlyReport: null,
  monthlyReportLoading: false,
  monthlyReportError: null,
};

const attendanceSlice = createSlice({
  name: "attendance",
  initialState,
  reducers: {
    clearAttendanceError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttendanceThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAttendanceThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchAttendanceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      // Manual CRUD actions simply trigger a refresh in the component, 
      // but we track errors here for toasts.
      .addCase(createAttendanceThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createAttendanceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateAttendanceThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updateAttendanceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateAttendanceDeductionSourceThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updateAttendanceDeductionSourceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateAttendanceRestDayWorkThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updateAttendanceRestDayWorkThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteAttendanceThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(deleteAttendanceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(importAttendanceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchMonthlyReportThunk.pending, (state) => {
        state.monthlyReportLoading = true;
        state.monthlyReportError = null;
      })
      .addCase(fetchMonthlyReportThunk.fulfilled, (state, action) => {
        state.monthlyReportLoading = false;
        state.monthlyReport = action.payload;
      })
      .addCase(fetchMonthlyReportThunk.rejected, (state, action) => {
        state.monthlyReportLoading = false;
        state.monthlyReportError = action.payload || action.error.message;
      });
  },
});

export const { clearAttendanceError } = attendanceSlice.actions;
export default attendanceSlice.reducer;
