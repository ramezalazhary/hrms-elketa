import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { 
  getAttendanceApi, 
  importAttendanceApi, 
  createAttendanceApi, 
  updateAttendanceApi, 
  deleteAttendanceApi 
} from "./api";

export const fetchAttendanceThunk = createAsyncThunk(
  "attendance/fetch",
  async (params) => getAttendanceApi(params),
);

export const createAttendanceThunk = createAsyncThunk(
  "attendance/create",
  async (data) => createAttendanceApi(data),
);

export const updateAttendanceThunk = createAsyncThunk(
  "attendance/update",
  async ({ id, data }) => updateAttendanceApi(id, data),
);

export const deleteAttendanceThunk = createAsyncThunk(
  "attendance/delete",
  async (id) => deleteAttendanceApi(id),
);

export const importAttendanceThunk = createAsyncThunk(
  "attendance/import",
  async ({ file, overwrite }) => importAttendanceApi(file, overwrite),
);

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

const attendanceSlice = createSlice({
  name: "attendance",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttendanceThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAttendanceThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchAttendanceThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      })
      // Manual CRUD actions simply trigger a refresh in the component, 
      // but we could also update local state here if needed.
      .addCase(createAttendanceThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updateAttendanceThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(deleteAttendanceThunk.fulfilled, (state) => {
        state.isLoading = false;
      });
  },
});

export default attendanceSlice.reducer;
