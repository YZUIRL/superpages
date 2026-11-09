import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InsightsIcon from '@mui/icons-material/Insights';
import LaunchIcon from '@mui/icons-material/Launch';
import DownloadIcon from '@mui/icons-material/Download';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SaveIcon from '@mui/icons-material/Save';

import api from '../api';
import TagInput from '../components/TagInput';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

const fieldSx = {
  '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': { color: 'white' },
  '& .MuiInputLabel-root': { color: '#B0B0B0' },
  '& .MuiFormHelperText-root': { color: '#888' },
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#555' },
    '&:hover fieldset': { borderColor: '#888' },
    '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' },
  },
};

const selectSx = {
  color: 'white',
  '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-yellow)' },
  '.MuiSvgIcon-root': { color: '#B0B0B0' },
};

const answerTypes = [
  { value: 'single_choice', label: '單選題' },
  { value: 'multiple_choice', label: '多選題' },
  { value: 'text', label: '簡答文字' },
  { value: 'textarea', label: '多行文字' },
  { value: 'number', label: '數字' },
  { value: 'phone', label: '手機號碼' },
  { value: 'email', label: '電子信箱' },
  { value: 'date', label: '日期' },
  { value: 'time', label: '時間' },
];

const generateOptionId = () => `opt_${Math.random().toString(36).substring(2, 10)}`;

const createDefaultSingleOptions = () => [
  { id: generateOptionId(), text: '選項 1', tag: null, expanded: false },
  { id: generateOptionId(), text: '選項 2', tag: null, expanded: false },
];

const emptyQuestion = () => ({
  content: '',
  answer_type: 'single_choice',
  required: true,
  condition_type: '3',
  condition_detail: '',
  optionsText: '',
  singleOptions: createDefaultSingleOptions(),
  tags: [],
});

const LIFF_ENTRY_URL = 'https://liff.line.me/2009851813-eNpc9OUb';

export default function Questionnaire() {
  const { oaId } = useParams();
  const { myOAs } = useAuth();
  const { showToast } = useToast();
  const authHeaders = useMemo(() => ({ headers: { 'X-OA-ID': oaId } }), [oaId]);
  const botAppName = useMemo(() => {
    const currentOA = myOAs.find(oa => oa.id.toString() === oaId?.toString());
    return currentOA?.other_settings?.app_name || '';
  }, [myOAs, oaId]);

  // 模式：'list' (問卷列表) 或 'editor' (問卷編輯器)
  const [viewMode, setViewMode] = useState('list');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [editingSurveyKey, setEditingSurveyKey] = useState(null);

  const [projectsList, setProjectsList] = useState([]);
  const [richMenusList, setRichMenusList] = useState([]);
  const [lineGroupsList, setLineGroupsList] = useState([]);
  const [crmTagsList, setCrmTagsList] = useState([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'published',
    startTime: '',
    endTime: '',
    finishMessage: '感謝你的填寫',
    themeColor: '#F8FAFC',
    bgImage: '',
    finishTags: [],
    finishJourney: '',
    finishMenu: '',
    questions: [emptyQuestion()],
  });

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await api.get('/liff-questionnaires', authHeaders);
      setSurveys(res.data.surveys || []);
    } catch (e) {
      showToast(e.response?.data?.error || '讀取 LIFF 問卷失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    try {
      const [projRes, rmRes, grpRes, tagRes] = await Promise.all([
        api.get('/projects', authHeaders).catch(() => ({ data: [] })),
        api.get('/richmenu/metadata', authHeaders).catch(() => ({ data: [] })),
        api.get('/liff-questionnaires/line-groups', authHeaders).catch(() => ({ data: { groups: [] } })),
        api.get('/customers/tags', authHeaders).catch(() => ({ data: [] })),
      ]);
      setProjectsList(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.projects || []));
      setRichMenusList(Array.isArray(rmRes.data) ? rmRes.data : []);
      setLineGroupsList(Array.isArray(grpRes.data?.groups) ? grpRes.data.groups : []);

      // 整理既有 CRM 標籤
      const rawTags = tagRes.data || [];
      const tags = rawTags.map(t => (typeof t === 'string' ? t : t.tag_name || '')).filter(Boolean);
      setCrmTagsList(Array.from(new Set(tags)));
    } catch (e) {
      console.error('Failed to fetch auxiliary data:', e);
    }
  };

  useEffect(() => {
    fetchSurveys();
    fetchAuxiliaryData();
    setViewMode('list');
    setEditingSurveyKey(null);
    resetForm();
    setIsDirty(false);
  }, [oaId]);

  const normalizeSingleOptions = (rawOptions) => {
    if (!rawOptions) return createDefaultSingleOptions();
    if (typeof rawOptions === 'string') {
      const parts = rawOptions.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return createDefaultSingleOptions();
      return parts.map(text => ({
        id: generateOptionId(),
        text,
        tag: null,
        expanded: false,
      }));
    }
    if (Array.isArray(rawOptions)) {
      if (rawOptions.length === 0) return createDefaultSingleOptions();
      return rawOptions.map(item => {
        if (typeof item === 'object' && item !== null) {
          return {
            id: item.id || generateOptionId(),
            text: item.text || item.label || '',
            tag: item.tag ? String(item.tag).trim() : null,
            expanded: false,
          };
        }
        return {
          id: generateOptionId(),
          text: String(item).trim(),
          tag: null,
          expanded: false,
        };
      });
    }
    return createDefaultSingleOptions();
  };

  const updateQuestion = (index, patch) => {
    setIsDirty(true);
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const updateSingleOption = (qIndex, optIndex, patch) => {
    setIsDirty(true);
    setForm(prev => {
      const q = prev.questions[qIndex];
      const newOpts = q.singleOptions.map((opt, i) => (i === optIndex ? { ...opt, ...patch } : opt));
      return {
        ...prev,
        questions: prev.questions.map((currQ, i) => (i === qIndex ? { ...currQ, singleOptions: newOpts } : currQ)),
      };
    });
  };

  const addSingleOption = (qIndex) => {
    setIsDirty(true);
    setForm(prev => {
      const q = prev.questions[qIndex];
      const newOpts = [
        ...(q.singleOptions || []),
        { id: generateOptionId(), text: `選項 ${(q.singleOptions || []).length + 1}`, tag: null, expanded: false },
      ];
      return {
        ...prev,
        questions: prev.questions.map((currQ, i) => (i === qIndex ? { ...currQ, singleOptions: newOpts } : currQ)),
      };
    });
  };

  const deleteSingleOption = (qIndex, optIndex) => {
    setIsDirty(true);
    setForm(prev => {
      const q = prev.questions[qIndex];
      if ((q.singleOptions || []).length <= 1) {
        showToast('至少需要保留一個選項', 'warning');
        return prev;
      }
      const newOpts = q.singleOptions.filter((_, i) => i !== optIndex);
      return {
        ...prev,
        questions: prev.questions.map((currQ, i) => (i === qIndex ? { ...currQ, singleOptions: newOpts } : currQ)),
      };
    });
  };

  const moveSingleOption = (qIndex, optIndex, direction) => {
    setIsDirty(true);
    setForm(prev => {
      const q = prev.questions[qIndex];
      const opts = [...(q.singleOptions || [])];
      const targetIndex = optIndex + direction;
      if (targetIndex < 0 || targetIndex >= opts.length) return prev;
      const temp = opts[optIndex];
      opts[optIndex] = opts[targetIndex];
      opts[targetIndex] = temp;
      return {
        ...prev,
        questions: prev.questions.map((currQ, i) => (i === qIndex ? { ...currQ, singleOptions: opts } : currQ)),
      };
    });
  };

  const moveQuestion = (index, direction) => {
    setIsDirty(true);
    setForm(prev => {
      const questions = [...prev.questions];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= questions.length) return prev;
      const temp = questions[index];
      questions[index] = questions[targetIndex];
      questions[targetIndex] = temp;
      return { ...prev, questions };
    });
    setActiveQuestionIndex(prev => {
      const target = prev + direction;
      if (target >= 0 && target < form.questions.length) return target;
      return prev;
    });
  };

  const addQuestion = () => {
    setIsDirty(true);
    setForm(prev => ({
      ...prev,
      questions: [...prev.questions, emptyQuestion()],
    }));
    setActiveQuestionIndex(form.questions.length);
  };

  const deleteQuestion = (index) => {
    if (form.questions.length <= 1) {
      showToast('問卷至少需要一題', 'warning');
      return;
    }
    setIsDirty(true);
    setForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
    if (activeQuestionIndex >= index && activeQuestionIndex > 0) {
      setActiveQuestionIndex(activeQuestionIndex - 1);
    }
  };

  const makeLiffUrl = (survey, includeDynamicGroup = true) => {
    const url = new URL(LIFF_ENTRY_URL);
    url.searchParams.set('oaId', oaId);
    url.searchParams.set('surveyId', survey.survey_key);
    const appName = survey.bot_app_name || botAppName;
    if (appName) url.searchParams.set('botAppName', appName);

    let backendUrl = '';
    const baseURL = api.defaults.baseURL || '';
    if (baseURL.startsWith('http')) {
      backendUrl = baseURL.replace(/\/api$/, '');
    } else {
      const { protocol, hostname, port } = window.location;
      if (port === '5016') {
        backendUrl = `${protocol}//${hostname}:5017`;
      } else if (port === '9016') {
        backendUrl = `${protocol}//${hostname}:9017`;
      } else {
        backendUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
      }
    }
    if (backendUrl) {
      url.searchParams.set('backend', backendUrl);
    }

    return includeDynamicGroup ? `${url.toString()}&groupId=<%m.groupid%>` : url.toString();
  };

  const copyText = async (text, message = '已複製') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(message, 'success');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        if (successful) {
          showToast(message, 'success');
        } else {
          showToast('複製連結失敗，請手動複製', 'warning');
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      showToast('複製連結失敗，請手動複製', 'warning');
    }
  };

  const handleStartCreate = () => {
    resetForm();
    setEditingSurveyKey(null);
    setActiveQuestionIndex(0);
    setIsDirty(false);
    setViewMode('editor');
  };

  const handleStartEdit = async (survey) => {
    setSaving(true);
    try {
      showToast('正在讀取問卷詳情...', 'info');
      const res = await api.get(`/liff-questionnaires/${survey.survey_key}`, authHeaders);
      const detail = res.data.survey;
      setEditingSurveyKey(detail.survey_key);
      setForm({
        title: detail.title || '',
        description: detail.description || '',
        status: detail.status || 'published',
        startTime: detail.start_time ? detail.start_time.replace(' ', 'T') : '',
        endTime: detail.end_time ? detail.end_time.replace(' ', 'T') : '',
        finishMessage: detail.finish_message || '感謝你的填寫',
        themeColor: detail.theme_color || '#F8FAFC',
        bgImage: detail.bg_image || '',
        finishTags: detail.finish_tags || detail.default_tags || [],
        finishJourney: detail.finish_journey ? String(detail.finish_journey) : '',
        finishMenu: detail.finish_menu ? String(detail.finish_menu) : '',
        questions: (detail.questions || []).map(q => ({
          id: q.id,
          content: q.content || '',
          answer_type: q.answer_type || 'text',
          required: q.required !== undefined ? q.required : true,
          condition_type: q.condition_type || '1',
          condition_detail: q.condition_detail || '',
          optionsText: Array.isArray(q.options) && q.answer_type !== 'single_choice' ? q.options.join(',') : (typeof q.options === 'string' ? q.options : ''),
          singleOptions: q.answer_type === 'single_choice' ? normalizeSingleOptions(q.options) : createDefaultSingleOptions(),
          tags: q.tags || [],
        })),
      });
      setActiveQuestionIndex(0);
      setIsDirty(false);
      setViewMode('editor');
      showToast(`已載入問卷「${detail.title}」`, 'info');
    } catch (e) {
      showToast(e.response?.data?.error || '讀取問卷詳情失敗', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBackToList = async () => {
    if (isDirty) {
      const confirmResult = await Swal.fire({
        title: '尚未儲存變更',
        text: '您有尚未儲存的修改，確定要離開編輯器嗎？未儲存的內容將會遺失。',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4d4d',
        cancelButtonColor: '#555',
        confirmButtonText: '確定離開',
        cancelButtonText: '繼續編輯',
        background: '#1E1E1E',
        color: '#fff',
      });
      if (!confirmResult.isConfirmed) return;
    }
    setViewMode('list');
    setEditingSurveyKey(null);
    resetForm();
    setIsDirty(false);
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      status: 'published',
      startTime: '',
      endTime: '',
      finishMessage: '感謝你的填寫',
      themeColor: '#F8FAFC',
      bgImage: '',
      finishTags: [],
      finishJourney: '',
      finishMenu: '',
      questions: [emptyQuestion()],
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showToast('請輸入問卷名稱', 'error');
      return;
    }
    if (form.questions.some(q => !q.content.trim())) {
      showToast('每一題都需要輸入題目內容', 'error');
      return;
    }
    // 驗證單選題選項內容不可空白
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (q.answer_type === 'single_choice') {
        if (!q.singleOptions || q.singleOptions.length === 0) {
          showToast(`第 ${i + 1} 題單選題至少需要一個選項`, 'error');
          setActiveQuestionIndex(i);
          return;
        }
        if (q.singleOptions.some(opt => !opt.text.trim())) {
          showToast(`第 ${i + 1} 題單選題有選項未填寫文字`, 'error');
          setActiveQuestionIndex(i);
          return;
        }
      }
    }

    setSaving(true);
    try {
      showToast(editingSurveyKey ? '正在儲存修改...' : '正在建立問卷...', 'info');

      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        bot_app_name: botAppName,
        start_time: form.startTime,
        end_time: form.endTime,
        finish_message: form.finishMessage,
        theme_color: form.themeColor,
        bg_image: form.bgImage,
        finish_tags: form.finishTags,
        finish_journey: form.finishJourney,
        finish_menu: form.finishMenu,
        default_tags: form.finishTags,
        questions: form.questions.map((q, index) => {
          let serializedOptions;
          if (q.answer_type === 'single_choice') {
            serializedOptions = (q.singleOptions || []).map(opt => ({
              id: opt.id || generateOptionId(),
              text: opt.text.trim(),
              tag: opt.tag ? String(opt.tag).trim() : null,
            }));
          } else {
            serializedOptions = q.optionsText || '';
          }

          return {
            id: q.id,
            content: q.content,
            answer_type: q.answer_type,
            required: q.required,
            condition_type:
              q.answer_type === 'number'
                ? '2'
                : q.answer_type === 'phone'
                ? '5'
                : q.answer_type === 'email'
                ? '6'
                : q.answer_type === 'date'
                ? '7'
                : q.answer_type === 'time'
                ? '8'
                : q.answer_type.includes('choice')
                ? '3'
                : q.condition_type === '4'
                ? '4'
                : '1',
            condition_detail: q.condition_detail,
            options: serializedOptions,
            tags: q.tags,
            question_no: index + 1,
          };
        }),
      };

      let res;
      if (editingSurveyKey) {
        res = await api.put(`/liff-questionnaires/${editingSurveyKey}`, payload, authHeaders);
        showToast('LIFF 問卷已成功更新', 'success');
      } else {
        res = await api.post('/liff-questionnaires', payload, authHeaders);
        showToast('LIFF 問卷已成功建立', 'success');
      }

      const survey = res.data.survey;
      await fetchSurveys();
      setIsDirty(false);
      setViewMode('list');
      setEditingSurveyKey(null);
      resetForm();

      if (!editingSurveyKey && survey) {
        setSelectedSurvey(survey);
        await copyText(makeLiffUrl(survey), '問卷已建立，LIFF 連結也已複製');
      }
    } catch (e) {
      showToast(e.response?.data?.error || (editingSurveyKey ? '更新問卷失敗' : '建立問卷失敗'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('錯誤：必須為圖片檔 (JPEG/PNG)', 'error');
      return;
    }
    if (file.size > 1024 * 1024) {
      showToast('圖片大小不可超過 1 MB', 'error');
      return;
    }
    setSaving(true);
    showToast('圖片上傳中...', 'info');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/github', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-OA-ID': oaId },
      });
      if (res.data && res.data.url) {
        setIsDirty(true);
        setForm(prev => ({ ...prev, bgImage: res.data.url }));
        showToast('圖片上傳成功', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.message || '圖片上傳失敗', 'error');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (survey) => {
    const confirmResult = await Swal.fire({
      title: '確定刪除',
      text: `確定刪除「${survey.title}」？作答資料也會一起刪除。`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff4d4d',
      cancelButtonColor: '#555',
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      background: '#1E1E1E',
      color: '#fff',
    });
    if (!confirmResult.isConfirmed) return;
    try {
      await api.delete(`/liff-questionnaires/${survey.survey_key}`, authHeaders);
      showToast('問卷已刪除', 'success');
      fetchSurveys();
    } catch (e) {
      showToast(e.response?.data?.error || '刪除失敗', 'error');
    }
  };

  const openResponses = async (survey) => {
    setSelectedSurvey(survey);
    setResponsesOpen(true);
    setLoadingResponses(true);
    try {
      const res = await api.get(`/liff-questionnaires/${survey.survey_key}/responses`, authHeaders);
      setResponses(res.data.responses || []);
    } catch (e) {
      showToast(e.response?.data?.error || '讀取作答失敗', 'error');
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleDownload = async (survey) => {
    showToast('準備下載中...', 'info');
    try {
      const res = await api.get(`/liff-questionnaires/${survey.survey_key}/download`, {
        ...authHeaders,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${survey.title}_問卷結果.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showToast('下載失敗', 'error');
    }
  };

  // 當前聚焦編輯的題目
  const currentQ = form.questions[activeQuestionIndex] || form.questions[0];

  // 計算當前題目單選標籤設定進度
  const singleTagProgress = useMemo(() => {
    if (!currentQ || currentQ.answer_type !== 'single_choice' || !currentQ.singleOptions) {
      return { total: 0, tagged: 0, percent: 0 };
    }
    const total = currentQ.singleOptions.length;
    const tagged = currentQ.singleOptions.filter(opt => opt.tag && String(opt.tag).trim()).length;
    const percent = total > 0 ? Math.round((tagged / total) * 100) : 0;
    return { total, tagged, percent };
  }, [currentQ]);

  // ==================== 渲染：Layer 1 問卷列表 ====================
  const renderListView = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold' }}>
            LIFF 問卷管理
          </Typography>
          <Typography variant="body2" sx={{ color: '#aaa', mt: 0.5 }}>
            建立與發布 LINE LIFF 問卷，支援單選題目答案獨立 CRM 標籤配置與自動化旅程。
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleStartCreate}
          sx={{
            background: 'var(--primary-yellow)',
            color: '#111',
            fontWeight: 'bold',
            '&:hover': { background: '#f5c400' },
          }}
        >
          建立新問卷
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'var(--primary-yellow)' }} />
        </Box>
      ) : surveys.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', background: '#222', border: '1px solid #444' }}>
          <Typography sx={{ color: '#aaa', mb: 2 }}>目前尚未建立任何 LIFF 問卷。</Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleStartCreate} sx={{ color: 'var(--primary-yellow)', borderColor: 'var(--primary-yellow)' }}>
            立即建立第一份問卷
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {surveys.map(survey => {
            let statusLabel = '草稿';
            let statusColor = '#555';

            if (survey.status === 'published') {
              const now = new Date();
              const start = survey.start_time ? new Date(survey.start_time) : null;
              const end = survey.end_time ? new Date(survey.end_time) : null;

              if (start && start > now) {
                statusLabel = '尚未開始';
                statusColor = '#ed6c02';
              } else if (end && end < now) {
                statusLabel = '已結束';
                statusColor = '#d32f2f';
              } else {
                statusLabel = '開放中';
                statusColor = '#2e7d32';
              }
            }

            const finishJourneyObj = projectsList.find(p => String(p.project_id || p.id) === String(survey.finish_journey));
            const finishMenuObj = richMenusList.find(
              m => String(m.ui_uuid || m.richMenuId || m.rich_menu_id || m.id) === String(survey.finish_menu)
            );
            const finishTagsList = survey.finish_tags || survey.default_tags || [];

            return (
              <Paper key={survey.survey_key} sx={{ p: 2.5, background: '#222', border: '1px solid #444', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ flex: 1, minWidth: '280px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 'bold', fontSize: '1.15rem' }}>{survey.title}</Typography>
                      <Chip size="small" label={statusLabel} sx={{ background: statusColor, color: '#fff', fontWeight: 'bold' }} />
                    </Box>
                    {survey.description && (
                      <Typography sx={{ color: '#aaa', fontSize: '0.88rem', mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {survey.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                      <Chip size="small" label={`${survey.question_count || 0} 題`} sx={{ background: '#333', color: '#ddd' }} />
                      <Chip size="small" label={`${survey.response_count || 0} 份作答`} sx={{ background: '#333', color: '#ddd' }} />
                      {finishTagsList.map(tag => (
                        <Chip key={tag} size="small" icon={<LocalOfferIcon style={{ fontSize: 13, color: '#a5d6a7' }} />} label={`完成標籤: ${tag}`} sx={{ background: '#2e4c38', color: '#a5d6a7' }} />
                      ))}
                      {finishJourneyObj && <Chip size="small" label={`旅程: ${finishJourneyObj.project_name}`} sx={{ background: '#303f9f', color: '#c5cae9' }} />}
                      {finishMenuObj && <Chip size="small" label={`選單: ${finishMenuObj.name || finishMenuObj.richMenuId || finishMenuObj.rich_menu_id}`} sx={{ background: '#512da8', color: '#d1c4e9' }} />}
                      {(survey.question_tags || []).map(tag => (
                        <Chip key={tag} size="small" label={`題目標籤: ${tag}`} sx={{ background: '#4b3f12', color: '#ffe082' }} />
                      ))}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleStartEdit(survey)}
                      sx={{ color: '#4fc3f7', borderColor: '#4fc3f7', '&:hover': { borderColor: '#81d4fa' } }}
                    >
                      編輯問卷
                    </Button>
                    <Tooltip title="查看作答結果">
                      <IconButton onClick={() => openResponses(survey)} sx={{ color: '#ffb300', background: '#333' }}>
                        <InsightsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="下載作答結果 (CSV)">
                      <IconButton onClick={() => handleDownload(survey)} sx={{ color: '#ba68c8', background: '#333' }}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="複製 LIFF 連結 (帶動態群組識別)">
                      <IconButton onClick={() => copyText(makeLiffUrl(survey, true), 'LIFF 連結已複製')} sx={{ color: '#81c784', background: '#333' }}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="直接開啟問卷預覽">
                      <IconButton component="a" href={makeLiffUrl(survey, false)} target="_blank" rel="noreferrer" sx={{ color: '#4fc3f7', background: '#333' }}>
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="刪除問卷">
                      <IconButton onClick={() => handleDelete(survey)} sx={{ color: '#e57373', background: '#333' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );

  // ==================== 渲染：Layer 2 問卷編輯器 ====================
  const renderEditorView = () => (
    <Box>
      {/* 頂部導航與操作列 */}
      <Paper sx={{ p: 2, mb: 3, background: '#222', border: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBackToList} sx={{ color: '#ddd' }}>
            返回列表
          </Button>
          <Divider orientation="vertical" flexItem sx={{ borderColor: '#555' }} />
          <Typography variant="h6" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold' }}>
            {editingSurveyKey ? `編輯問卷: ${form.title || '未命名問卷'}` : '建立新問卷'}
          </Typography>
          {isDirty && (
            <Chip size="small" label="尚未儲存變更" sx={{ background: '#ed6c02', color: '#fff', fontSize: '0.75rem' }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" onClick={handleBackToList} disabled={saving} sx={{ color: '#aaa', borderColor: '#555' }}>
            取消
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
            sx={{
              background: 'var(--primary-yellow)',
              color: '#111',
              fontWeight: 'bold',
              '&:hover': { background: '#f5c400' },
            }}
          >
            {saving ? '儲存中...' : editingSurveyKey ? '儲存問卷修改' : '建立並儲存問卷'}
          </Button>
        </Box>
      </Paper>

      {/* 主體兩欄式佈局：左側導航與設定，右側逐題聚焦編輯工作區 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px 1fr' }, gap: 3, alignItems: 'start' }}>
        {/* 左側：問卷基本資訊與題目導航 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 基本資料卡片 */}
          <Paper sx={{ p: 2, background: '#222', border: '1px solid #444', borderRadius: 2 }}>
            <Typography sx={{ color: '#fff', fontWeight: 'bold', mb: 1.5, fontSize: '1rem' }}>問卷基本設定</Typography>
            <TextField
              fullWidth
              size="small"
              label="問卷名稱 *"
              value={form.title}
              onChange={e => {
                setIsDirty(true);
                setForm({ ...form, title: e.target.value });
              }}
              sx={{ ...fieldSx, mb: 1.5 }}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="問卷說明"
              value={form.description}
              onChange={e => {
                setIsDirty(true);
                setForm({ ...form, description: e.target.value });
              }}
              sx={{ ...fieldSx, mb: 1.5 }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
              <TextField
                size="small"
                type="datetime-local"
                label="開始時間"
                InputLabelProps={{ shrink: true }}
                value={form.startTime}
                onChange={e => {
                  setIsDirty(true);
                  setForm({ ...form, startTime: e.target.value });
                }}
                sx={fieldSx}
              />
              <TextField
                size="small"
                type="datetime-local"
                label="結束時間"
                InputLabelProps={{ shrink: true }}
                value={form.endTime}
                onChange={e => {
                  setIsDirty(true);
                  setForm({ ...form, endTime: e.target.value });
                }}
                sx={fieldSx}
              />
            </Box>

            <TextField
              fullWidth
              size="small"
              label="完成填答訊息"
              value={form.finishMessage}
              onChange={e => {
                setIsDirty(true);
                setForm({ ...form, finishMessage: e.target.value });
              }}
              sx={{ ...fieldSx, mb: 1.5 }}
            />

            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
              <TextField
                size="small"
                label="問卷主題色"
                value={form.themeColor}
                onChange={e => {
                  setIsDirty(true);
                  setForm({ ...form, themeColor: e.target.value });
                }}
                sx={{ ...fieldSx, flex: 1 }}
              />
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(form.themeColor) ? form.themeColor : '#F8FAFC'}
                onChange={e => {
                  setIsDirty(true);
                  setForm({ ...form, themeColor: e.target.value.toUpperCase() });
                }}
                style={{ width: '38px', height: '38px', padding: 0, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                title="選擇顏色"
              />
            </Box>

            {/* 背景圖片上傳 */}
            <Box sx={{ p: 1.5, mb: 1.5, background: '#2a2a2a', borderRadius: 1, border: '1px solid #444' }}>
              <Button variant="outlined" component="label" size="small" sx={{ color: 'white', borderColor: '#555', mb: 1 }} disabled={saving}>
                {saving ? '上傳中...' : '更換背景底圖'}
                <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
              </Button>
              {form.bgImage ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <img src={form.bgImage} alt="bg" style={{ height: '32px', width: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                  <Typography sx={{ color: '#aaa', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.bgImage}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setIsDirty(true);
                      setForm({ ...form, bgImage: '' });
                    }}
                    sx={{ color: '#e57373' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Typography sx={{ color: '#888', fontSize: '11px' }}>若未上傳圖片，前台將以主題色呈現背景。</Typography>
              )}
            </Box>

            {/* 完成後自動化動作 */}
            <Box sx={{ p: 1.5, background: '#2a2a2a', borderRadius: 1, border: '1px solid #444' }}>
              <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1, fontSize: '0.88rem' }}>完成後動作</Typography>
              <Typography sx={{ color: '#B0B0B0', fontSize: '0.8rem', mb: 0.5 }}>問卷完成標籤</Typography>
              <TagInput
                tags={form.finishTags || []}
                onChange={finishTags => {
                  setIsDirty(true);
                  setForm({ ...form, finishTags });
                }}
                placeholder="輸入標籤並按 Enter"
              />

              <FormControl fullWidth size="small" sx={{ ...fieldSx, mt: 1.5 }}>
                <InputLabel sx={{ color: '#B0B0B0' }}>加入自動旅程</InputLabel>
                <Select
                  value={form.finishJourney || ''}
                  label="加入自動旅程"
                  onChange={e => {
                    setIsDirty(true);
                    setForm({ ...form, finishJourney: e.target.value });
                  }}
                  sx={selectSx}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#222', color: 'white' } } }}
                >
                  <MenuItem value="">-- 不加入旅程 --</MenuItem>
                  {projectsList.map(p => (
                    <MenuItem key={p.project_id || p.id} value={String(p.project_id || p.id)}>
                      {p.project_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" sx={{ ...fieldSx, mt: 1.5 }}>
                <InputLabel sx={{ color: '#B0B0B0' }}>切換圖文選單</InputLabel>
                <Select
                  value={form.finishMenu || ''}
                  label="切換圖文選單"
                  onChange={e => {
                    setIsDirty(true);
                    setForm({ ...form, finishMenu: e.target.value });
                  }}
                  sx={selectSx}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#222', color: 'white' } } }}
                >
                  <MenuItem value="">-- 不切換選單 --</MenuItem>
                  {richMenusList.map(m => {
                    const menuVal = m.ui_uuid || m.richMenuId || m.rich_menu_id || m.id;
                    return (
                      <MenuItem key={menuVal} value={String(menuVal)}>
                        {m.name || m.richMenuId || m.rich_menu_id}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* 題目清單導航 (Question Navigator) */}
          <Paper sx={{ p: 2, background: '#222', border: '1px solid #444', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>問卷題目列表 ({form.questions.length})</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addQuestion} sx={{ color: 'var(--primary-yellow)' }}>
                新增題目
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {form.questions.map((q, idx) => {
                const isSelected = idx === activeQuestionIndex;
                const typeLabel = answerTypes.find(t => t.value === q.answer_type)?.label || '文字';

                // 計算單選題標籤設定數
                let optBadge = null;
                if (q.answer_type === 'single_choice' && q.singleOptions) {
                  const taggedCount = q.singleOptions.filter(o => o.tag && String(o.tag).trim()).length;
                  optBadge = `${taggedCount}/${q.singleOptions.length} 標籤`;
                }

                return (
                  <Paper
                    key={idx}
                    onClick={() => setActiveQuestionIndex(idx)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      background: isSelected ? '#333' : '#282828',
                      border: isSelected ? '1.5px solid var(--primary-yellow)' : '1px solid #444',
                      borderRadius: 1,
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: isSelected ? 'var(--primary-yellow)' : '#666' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: isSelected ? 'var(--primary-yellow)' : '#ddd', fontWeight: 'bold', fontSize: '0.9rem', width: '45px' }}>
                        第 {idx + 1} 題
                      </Typography>
                      <Typography
                        sx={{
                          color: '#fff',
                          fontSize: '0.85rem',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {q.content || <span style={{ color: '#888' }}>(未填寫題目內容)</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                        <IconButton
                          size="small"
                          disabled={idx === 0}
                          onClick={e => {
                            e.stopPropagation();
                            moveQuestion(idx, -1);
                          }}
                          sx={{ color: '#888', p: 0.25 }}
                        >
                          <ArrowUpwardIcon fontSize="inherit" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={idx === form.questions.length - 1}
                          onClick={e => {
                            e.stopPropagation();
                            moveQuestion(idx, 1);
                          }}
                          sx={{ color: '#888', p: 0.25 }}
                        >
                          <ArrowDownwardIcon fontSize="inherit" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={form.questions.length === 1}
                          onClick={e => {
                            e.stopPropagation();
                            deleteQuestion(idx);
                          }}
                          sx={{ color: '#e57373', p: 0.25 }}
                        >
                          <DeleteIcon fontSize="inherit" />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, alignItems: 'center' }}>
                      <Chip size="small" label={typeLabel} sx={{ height: 20, fontSize: '0.7rem', background: '#444', color: '#eee' }} />
                      {q.required && <Chip size="small" label="必填" sx={{ height: 20, fontSize: '0.7rem', background: '#b71c1c', color: '#fff' }} />}
                      {optBadge && (
                        <Chip
                          size="small"
                          icon={<LocalOfferIcon style={{ fontSize: 11, color: '#a5d6a7' }} />}
                          label={optBadge}
                          sx={{ height: 20, fontSize: '0.7rem', background: '#2e4c38', color: '#a5d6a7' }}
                        />
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        </Box>

        {/* 右側：逐題聚焦編輯工作區 (Focus One Question) */}
        <Box>
          <Paper sx={{ p: 3, background: '#222', border: '1px solid #444', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: '1px solid #444' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold' }}>
                  第 {activeQuestionIndex + 1} 題設定
                </Typography>
                <Typography sx={{ color: '#888', fontSize: '0.85rem' }}>
                  (聚焦編輯模式：一次專注單一題目)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  disabled={activeQuestionIndex === 0}
                  onClick={() => setActiveQuestionIndex(activeQuestionIndex - 1)}
                  sx={{ color: '#aaa', borderColor: '#555' }}
                  variant="outlined"
                >
                  上一題
                </Button>
                <Button
                  size="small"
                  disabled={activeQuestionIndex === form.questions.length - 1}
                  onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
                  sx={{ color: '#aaa', borderColor: '#555' }}
                  variant="outlined"
                >
                  下一題
                </Button>
              </Box>
            </Box>

            {/* 題目主要屬性：題目內容、題型、必填 */}
            <TextField
              fullWidth
              size="small"
              label="題目內容 *"
              value={currentQ.content}
              onChange={e => updateQuestion(activeQuestionIndex, { content: e.target.value })}
              placeholder="例如：您對哪種課程有興趣？"
              sx={{ ...fieldSx, mb: 2 }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 2, mb: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#B0B0B0' }}>題目答案類型</InputLabel>
                <Select
                  value={currentQ.answer_type}
                  label="題目答案類型"
                  onChange={e => {
                    const newType = e.target.value;
                    const patch = { answer_type: newType };
                    if (newType === 'single_choice' && (!currentQ.singleOptions || currentQ.singleOptions.length === 0)) {
                      patch.singleOptions = createDefaultSingleOptions();
                    }
                    updateQuestion(activeQuestionIndex, patch);
                  }}
                  sx={selectSx}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#222', color: 'white' } } }}
                >
                  {answerTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Paper sx={{ background: '#2a2a2a', border: '1px solid #444', display: 'flex', alignItems: 'center', px: 1.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentQ.required}
                      onChange={e => updateQuestion(activeQuestionIndex, { required: e.target.checked })}
                      color="warning"
                    />
                  }
                  label={<Typography sx={{ color: '#ddd', fontSize: '0.9rem' }}>必填題</Typography>}
                />
              </Paper>
            </Box>

            {/* ================= 單選題專用面板：獨立資料列 + Accordion 標籤設定 ================= */}
            {currentQ.answer_type === 'single_choice' && (
              <Box sx={{ mb: 3, p: 2.5, background: '#1c1c1e', border: '1px solid #383838', borderRadius: 2 }}>
                {/* 上標進度提示列 (Progress Indicator) */}
                <Box sx={{ mb: 2.5, p: 1.5, background: '#252528', borderRadius: 1.5, border: '1px solid #3f3f46' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography sx={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      CRM 標籤配置進度：{singleTagProgress.tagged} / {singleTagProgress.total} 個選項已設定標籤
                    </Typography>
                    <Typography sx={{ color: 'var(--primary-yellow)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {singleTagProgress.percent}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={singleTagProgress.percent}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      background: '#444',
                      '& .MuiLinearProgress-bar': { background: 'var(--primary-yellow)' },
                    }}
                  />
                  <Typography sx={{ color: '#888', fontSize: '0.75rem', mt: 0.75 }}>
                    提示：未設定標籤之選項在填答時將不會套用標籤（非必填項，不影響問卷作答）。
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography sx={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.95rem' }}>
                    單選選項管理（每個選項獨立管理、支援設定 0～1 個 CRM 標籤）
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => addSingleOption(activeQuestionIndex)}
                    sx={{ color: 'var(--primary-yellow)' }}
                  >
                    新增選項
                  </Button>
                </Box>

                {/* 獨立選項清單 */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {(currentQ.singleOptions || []).map((opt, optIdx) => {
                    const isExpanded = !!opt.expanded;
                    const hasTag = opt.tag && String(opt.tag).trim();

                    return (
                      <Paper
                        key={opt.id || optIdx}
                        sx={{
                          p: 1.5,
                          background: '#28282b',
                          border: isExpanded ? '1px solid var(--primary-yellow)' : '1px solid #444',
                          borderRadius: 1.5,
                          transition: 'border-color 0.2s',
                        }}
                      >
                        {/* 選項主要資料列 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {/* 排序控制 */}
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <IconButton
                              size="small"
                              disabled={optIdx === 0}
                              onClick={() => moveSingleOption(activeQuestionIndex, optIdx, -1)}
                              sx={{ color: '#888', p: 0.2 }}
                              title="上移"
                            >
                              <ArrowUpwardIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              disabled={optIdx === (currentQ.singleOptions || []).length - 1}
                              onClick={() => moveSingleOption(activeQuestionIndex, optIdx, 1)}
                              sx={{ color: '#888', p: 0.2 }}
                              title="下移"
                            >
                              <ArrowDownwardIcon fontSize="inherit" />
                            </IconButton>
                          </Box>

                          <Typography sx={{ color: '#aaa', fontWeight: 'bold', width: '22px' }}>
                            {optIdx + 1}.
                          </Typography>

                          {/* 選項文字編輯 */}
                          <TextField
                            size="small"
                            value={opt.text}
                            onChange={e => updateSingleOption(activeQuestionIndex, optIdx, { text: e.target.value })}
                            placeholder="輸入選項文字"
                            sx={{ ...fieldSx, flex: 1 }}
                          />

                          {/* 標籤預覽狀態 Chip */}
                          <Box sx={{ minWidth: '150px', textAlign: 'center' }}>
                            {hasTag ? (
                              <Chip
                                size="small"
                                icon={<LocalOfferIcon style={{ fontSize: 13, color: '#a5d6a7' }} />}
                                label={`標籤: ${opt.tag}`}
                                sx={{ background: '#2e4c38', color: '#a5d6a7', fontWeight: 'bold' }}
                              />
                            ) : (
                              <Typography sx={{ color: '#777', fontSize: '0.8rem' }}>未設定標籤</Typography>
                            )}
                          </Box>

                          {/* Accordion 展開/收合開關 */}
                          <Tooltip title={isExpanded ? '收合 CRM 標籤設定' : '展開設定此選項的 CRM 標籤'}>
                            <IconButton
                              size="small"
                              onClick={() => updateSingleOption(activeQuestionIndex, optIdx, { expanded: !isExpanded })}
                              sx={{
                                color: isExpanded ? 'var(--primary-yellow)' : '#aaa',
                                background: '#333',
                                '&:hover': { background: '#444' },
                              }}
                            >
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Tooltip>

                          {/* 刪除選項按鈕 */}
                          <Tooltip title="刪除選項">
                            <span>
                              <IconButton
                                size="small"
                                disabled={(currentQ.singleOptions || []).length <= 1}
                                onClick={() => deleteSingleOption(activeQuestionIndex, optIdx)}
                                sx={{ color: '#e57373', p: 0.5 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>

                        {/* Accordion 展開區：此選項的 CRM 標籤設定 (0～1 個) */}
                        <Collapse in={isExpanded}>
                          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed #444', px: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <LocalOfferIcon sx={{ color: 'var(--primary-yellow)', fontSize: 18 }} />
                              <Typography sx={{ color: '#fff', fontSize: '0.88rem', fontWeight: 'bold' }}>
                                此選項的 CRM 標籤設定 (支援 0～1 個既有 CRM 標籤)
                              </Typography>
                            </Box>
                            <Typography sx={{ color: '#888', fontSize: '0.78rem', mb: 1.5 }}>
                              當作答者選擇「{opt.text || `選項 ${optIdx + 1}`}」時，可自動為其附加特定標籤；若不需上標則維持未設定。
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                              <Autocomplete
                                freeSolo
                                size="small"
                                options={crmTagsList}
                                value={opt.tag || ''}
                                onChange={(event, newValue) => {
                                  updateSingleOption(activeQuestionIndex, optIdx, { tag: newValue ? String(newValue).trim() : null });
                                }}
                                onInputChange={(event, newInputValue) => {
                                  if (event && event.type === 'change') {
                                    updateSingleOption(activeQuestionIndex, optIdx, { tag: newInputValue ? newInputValue.trim() : null });
                                  }
                                }}
                                sx={{ flex: 1, ...fieldSx }}
                                renderInput={params => (
                                  <TextField {...params} label="搜尋或輸入 CRM 標籤 (0～1 個)" placeholder="請選擇或輸入標籤名稱..." />
                                )}
                              />

                              {hasTag && (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<ClearIcon />}
                                  onClick={() => updateSingleOption(activeQuestionIndex, optIdx, { tag: null })}
                                  sx={{ color: '#aaa', borderColor: '#555', minWidth: '100px' }}
                                >
                                  清除標籤
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </Collapse>
                      </Paper>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* ================= 多選題面板 ================= */}
            {currentQ.answer_type === 'multiple_choice' && (
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="多選選項 (以逗號分隔)"
                  helperText="例如：選項A, 選項B, 選項C"
                  value={currentQ.optionsText}
                  onChange={e => updateQuestion(activeQuestionIndex, { optionsText: e.target.value })}
                  sx={fieldSx}
                />
              </Box>
            )}

            {/* 題目層級完成後標籤 (適用於答此題後加入標籤) */}
            <Box sx={{ p: 2, background: '#252528', borderRadius: 1.5, border: '1px solid #444' }}>
              <Typography sx={{ color: '#B0B0B0', fontSize: '0.88rem', fontWeight: 'bold', mb: 0.5 }}>
                答此題後加入之題目標籤 (通用標籤)
              </Typography>
              <TagInput
                tags={currentQ.tags || []}
                onChange={tags => updateQuestion(activeQuestionIndex, { tags })}
                placeholder="輸入標籤並按 Enter..."
              />
              <Typography sx={{ color: '#888', fontSize: '0.75rem', mt: 0.5 }}>
                只要使用者有回答此題，送出問卷時皆會附加此標籤。
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {viewMode === 'list' ? renderListView() : renderEditorView()}

      {/* 作答情況對話框 */}
      <Dialog open={responsesOpen} onClose={() => setResponsesOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ background: '#222', color: '#fff', borderBottom: '1px solid #444' }}>
          {selectedSurvey?.title} — 作答情況總覽
        </DialogTitle>
        <DialogContent dividers sx={{ background: '#1f1f1f' }}>
          {loadingResponses ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: 'var(--primary-yellow)' }} />
            </Box>
          ) : responses.length === 0 ? (
            <Typography sx={{ color: '#888', textAlign: 'center', py: 4 }}>目前尚無任何使用者作答紀錄。</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#ddd' }}>作答用戶</TableCell>
                  <TableCell sx={{ color: '#ddd' }}>作答時間</TableCell>
                  <TableCell sx={{ color: '#ddd' }}>標籤與來源資訊</TableCell>
                  <TableCell sx={{ color: '#ddd' }}>填答內容</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {responses.map(row => (
                  <TableRow key={row.response_id}>
                    <TableCell sx={{ color: '#fff', verticalAlign: 'top' }}>
                      <Box sx={{ fontWeight: 'bold' }}>{row.display_name || '(未提供姓名)'}</Box>
                      <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>{row.line_user_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#ccc', verticalAlign: 'top' }}>{row.submitted_at}</TableCell>
                    <TableCell sx={{ color: '#ccc', verticalAlign: 'top' }}>
                      {(row.source_meta?.default_tags || []).map(tag => (
                        <Chip key={tag} size="small" label={tag} sx={{ mr: 0.5, mb: 0.5, background: '#4b3f12', color: '#ffe082' }} />
                      ))}
                      {row.source_meta?.bot_app_name && (
                        <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>bot: {row.source_meta.bot_app_name}</Typography>
                      )}
                      {row.source_meta?.group_id && (
                        <Typography sx={{ color: '#80cbc4', fontSize: '0.75rem' }}>
                          群組: {(lineGroupsList.find(g => g.group_id === row.source_meta.group_id)?.group_name) || row.source_meta.group_id}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: '#ddd' }}>
                      {row.answers.map(answer => (
                        <Box key={answer.question_id} sx={{ mb: 1 }}>
                          <Typography sx={{ color: '#aaa', fontSize: '0.78rem' }}>
                            Q{answer.question_no}. {answer.question}
                          </Typography>
                          <Typography sx={{ color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {answer.answer || '-'}
                          </Typography>
                        </Box>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
