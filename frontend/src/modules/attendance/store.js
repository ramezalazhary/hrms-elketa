import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import attendanceApi from "./api";

const initialState = {
  events: [],
  dailyRecords: [],
  policies: [],
  metrics: [],
  todaySnapshot: null,
  periodSummary: null,
  payrollSummary: null,
  loading: false,
  error: null,
};

// Thunks
export const fetchEventsThunk = createAsyncThunk(
  "attendance/fetchEvents",
  async (params) => {
    const response = await attendanceApi.getEvents(params);
    return response.data;
  }
);

export const fetchDailyRecordsThunk = createAsyncThunk(
  "attendance/fetchDailyRecords",
  async (params) => {
    const response = await attendanceApi.getDailyRecords(params);
    return response.data;
  }
);

export const fetchPoliciesThunk = createAsyncThunk(
  "attendance/fetchPolicies",
  async () => {
    const response = await attendanceApi.getPolicies();
    return response.data;
  }
);

export const createPolicyThunk = createAsyncThunk(
  "attendance/createPolicy",
  async (data) => {
    const response = await attendanceApi.createPolicy(data);
    return response.data;
  }
);

export const updatePolicyThunk = createAsyncThunk(
  "attendance/updatePolicy",
  async ({ id, data }) => {
    const response = await attendanceApi.updatePolicy(id, data);
    return response.data;
  }
);

export const deletePolicyThunk = createAsyncThunk(
  "attendance/deletePolicy",
  async (id) => {
    await attendanceApi.deletePolicy(id);
    return id;
  }
);

export const fetchTodaySnapshotThunk = createAsyncThunk(
  "attendance/fetchTodaySnapshot",
  async () => {
    const response = await attendanceApi.getTodaySnapshot();
    return response.data;
  }
);

export const fetchPeriodSummaryThunk = createAsyncThunk(
  "attendance/fetchPeriodSummary",
  async ({ from, to }) => {
    const response = await attendanceApi.getPeriodSummary(from, to);
    return response.data;
  }
);

export const fetchMetricsThunk = createAsyncThunk(
  "attendance/fetchMetrics",
  async (params) => {
    const response = await attendanceApi.getMetrics(params);
    return response.data;
  }
);

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
      // Fetch Events
      .addCase(fetchEventsThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEventsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEventsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch Daily Records
      .addCase(fetchDailyRecordsThunk.fulfilled, (state, action) => {
        state.dailyRecords = action.payload.records;
      })
      // Fetch Policies
      .addCase(fetchPoliciesThunk.fulfilled, (state, action) => {
        state.policies = action.payload;
      })
      .addCase(createPolicyThunk.fulfilled, (state, action) => {
        state.policies.push(action.payload);
      })
      .addCase(updatePolicyThunk.fulfilled, (state, action) => {
        const index = state.policies.findIndex(p => (p.id === action.payload.id || p._id === action.payload._id));
        if (index !== -1) state.policies[index] = action.payload;
      })
      .addCase(deletePolicyThunk.fulfilled, (state, action) => {
        state.policies = state.policies.filter(p => (p.id !== action.payload && p._id !== action.payload));
      })
      // Fetch Today Snapshot
      .addCase(fetchTodaySnapshotThunk.fulfilled, (state, action) => {
        state.todaySnapshot = action.payload;
      })
      // Fetch Period Summary
      .addCase(fetchPeriodSummaryThunk.fulfilled, (state, action) => {
        state.periodSummary = action.payload;
      })
      // Fetch Metrics
      .addCase(fetchMetricsThunk.fulfilled, (state, action) => {
        state.metrics = action.payload;
      });
  },
});

export const attendanceReducer = attendanceSlice.reducer;
export const { clearAttendanceError } = attendanceSlice.actions;
