import sys
import unittest
from unittest.mock import patch, MagicMock

# 模擬缺少之環境模組
for mod in ['jwt', 'psycopg2', 'psycopg2.extras', 'dotenv', 'models']:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

sys.path.append('backend')
from flask import Flask, json

sys.path.append('backend')
from endpoints.richmenu import richmenu_bp, _IMAGE_CACHE, copy_rich_menu_image, async_migrate_rich_menu_users

class TestRichMenuHotUpdate(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.register_blueprint(richmenu_bp, url_prefix='/api/richmenu')
        self.client = self.app.test_client()

    @patch('endpoints.richmenu.get_line_token')
    @patch('requests.get')
    def test_copy_image_size_mismatch_blocks(self, mock_get, mock_token):
        """測試當選單尺寸變更時，後端 copy-image 端點是否能正確阻擋沿用舊圖並回傳 400"""
        mock_token.return_value = 'fake_token'

        # 模擬新選單為半版 2500x843，舊選單為全版 2500x1686
        def side_effect(url, **kwargs):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            if 'new_menu_123' in url:
                mock_resp.json.return_value = {'size': {'width': 2500, 'height': 843}}
            else:
                mock_resp.json.return_value = {'size': {'width': 2500, 'height': 1686}}
            return mock_resp

        mock_get.side_effect = side_effect

        with self.app.test_request_context():
            from flask import g
            g.current_oa_id = 'test_oa'
            # 呼叫裝飾器底層函數測試業務邏輯
            target_func = getattr(copy_rich_menu_image, '__wrapped__', copy_rich_menu_image)
            resp, code = target_func('new_menu_123', 'old_menu_456')
            data = resp.get_json()

            self.assertEqual(code, 400)
            self.assertEqual(data.get('error'), 'size_mismatch')
            self.assertIn('尺寸已變更', data.get('message', ''))
            print("test_copy_image_size_mismatch_blocks: 通過")

    @patch('endpoints.richmenu.get_line_token')
    @patch('requests.post')
    @patch('requests.get')
    def test_copy_image_success_uses_cache(self, mock_get, mock_post, mock_token):
        """測試尺寸相同時，能從快取讀取舊底圖並成功上傳至新選單"""
        mock_token.return_value = 'fake_token'

        # 尺寸一致
        def side_effect(url, **kwargs):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {'size': {'width': 2500, 'height': 1686}}
            return mock_resp

        mock_get.side_effect = side_effect

        # 預先置入快取
        _IMAGE_CACHE['old_menu_same_size'] = (b'fake_image_bytes', 'image/png')

        mock_upload_resp = MagicMock()
        mock_upload_resp.status_code = 200
        mock_post.return_value = mock_upload_resp

        with self.app.test_request_context():
            from flask import g
            g.current_oa_id = 'test_oa'
            target_func = getattr(copy_rich_menu_image, '__wrapped__', copy_rich_menu_image)
            resp = target_func('new_menu_same_size', 'old_menu_same_size')
            data = resp.get_json() if hasattr(resp, 'get_json') else resp[0].get_json()

            self.assertEqual(data.get('status'), 'success')
            self.assertIn('new_menu_same_size', _IMAGE_CACHE)
            print("test_copy_image_success_uses_cache: 通過")

    @patch('time.sleep')
    @patch('endpoints.richmenu.get_line_token')
    @patch('endpoints.richmenu.get_tenant_conn')
    @patch('requests.post')
    @patch('requests.delete')
    @patch('requests.get')
    def test_async_migration_flow(self, mock_get, mock_delete, mock_post, mock_db_conn, mock_token, mock_sleep):
        """測試非同步背景遷移函式：用戶分批轉移、更新 Private_var、檢查 Alias、安全緩衝後刪除舊選單"""
        mock_token.return_value = 'fake_token'

        # 模擬 DB 查詢有 2 位綁定用戶
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = [
            ('U12345678901234567890123456789012',),
            ('Uabcdefabcdefabcdefabcdefabcdefab',),
        ]
        mock_conn.cursor.return_value = mock_cur
        mock_db_conn.return_value = mock_conn

        # 模擬 bulk/link 成功
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 200
        mock_post.return_value = mock_post_resp

        # 模擬 Alias list
        mock_alias_resp = MagicMock()
        mock_alias_resp.status_code = 200
        mock_alias_resp.json.return_value = {
            'aliases': [{'richMenuAliasId': 'alias-1', 'richMenuId': 'old_rm_999'}]
        }
        mock_get.return_value = mock_alias_resp

        # 模擬刪除舊選單成功
        mock_del_resp = MagicMock()
        mock_del_resp.status_code = 200
        mock_delete.return_value = mock_del_resp

        _IMAGE_CACHE['old_rm_999'] = (b'data', 'image/png')

        # 執行非同步遷移
        async_migrate_rich_menu_users(
            app_name='test_app',
            old_rich_menu_id='old_rm_999',
            new_rich_menu_id='new_rm_111',
            oa_id=None,
            status='published'
        )

        # 驗證是否有呼叫 bulk/link
        bulk_link_called = any('bulk/link' in str(call) for call in mock_post.call_args_list)
        self.assertTrue(bulk_link_called, "應該呼叫 LINE bulk/link 批次綁定用戶")

        # 驗證是否有更新 Alias
        alias_update_called = any('alias/alias-1' in str(call) for call in mock_post.call_args_list)
        self.assertTrue(alias_update_called, "應該更新 LINE Alias 指向新選單")

        # 驗證安全緩衝有被調用
        mock_sleep.assert_called_with(3)

        # 驗證舊選單已刪除且舊快取已被清理
        mock_delete.assert_called_once()
        self.assertNotIn('old_rm_999', _IMAGE_CACHE)
        print("test_async_migration_flow: 通過")

if __name__ == '__main__':
    unittest.main()
