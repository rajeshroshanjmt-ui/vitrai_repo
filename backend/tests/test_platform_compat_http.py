import unittest
import warnings
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import platform_compat


class FakeDB:
    def commit(self):
        return None

    def delete(self, _obj):
        return None


class PlatformCompatHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        warnings.simplefilter('ignore', DeprecationWarning)

    def setUp(self):
        self.db = FakeDB()
        app = FastAPI()
        app.include_router(platform_compat.router, prefix='/api')

        def override_get_db():
            yield self.db

        app.dependency_overrides[platform_compat.get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    @staticmethod
    def _headers(role: str, tenant_id: str = 'tenant-platform-1') -> dict[str, str]:
        token = auth.create_token(
            {
                'sub': f'{role}@example.com',
                'tenant_id': tenant_id,
                'role': role,
                'user_id': f'user-{role}',
            }
        )
        return {'Authorization': f'Bearer {token}'}

    def test_chatmodels_include_anthropic_perplexity_and_gemini(self):
        response = self.client.get('/api/assistants/components/chatmodels', headers=self._headers('viewer'))

        self.assertEqual(response.status_code, 200)
        models = response.json()
        by_name = {model['name']: model for model in models}

        self.assertIn('anthropicChat', by_name)
        self.assertIn('perplexityChat', by_name)
        self.assertIn('gemini', by_name)

        self.assertEqual(by_name['anthropicChat']['credential']['credentialNames'], ['anthropicApi'])
        self.assertEqual(by_name['perplexityChat']['credential']['credentialNames'], ['perplexityApi'])
        self.assertEqual(by_name['gemini']['credential']['credentialNames'], ['googleGenerativeAI'])

    def test_create_assistant_allows_azure_type(self):
        with patch.object(platform_compat, '_create_resource') as create_mock:
            create_mock.return_value = type('Row', (), {'id': 'assistant-azure-1'})()
            response = self.client.post(
                '/api/assistants',
                headers=self._headers('editor'),
                json={
                    'type': 'AZURE',
                    'credential': 'cred-azure-1',
                    'details': '{"name":"Azure Ops Assistant"}',
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'id': 'assistant-azure-1'})
        payload = create_mock.call_args.args[5]
        self.assertEqual(payload['type'], 'AZURE')

    def test_list_azure_assistants_uses_azure_provider_type(self):
        with patch.object(platform_compat, '_list_provider_assistants', return_value=[]) as list_mock:
            response = self.client.get('/api/azure-assistants', headers=self._headers('viewer'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        self.assertEqual(list_mock.call_args.kwargs['assistant_type'], 'AZURE')

    def test_get_azure_assistant_passes_tenant_scoped_user(self):
        with patch.object(
            platform_compat,
            '_list_provider_assistants',
            return_value=[{'id': 'az-asst-1', 'name': 'Azure A'}],
        ) as list_mock:
            response = self.client.get(
                '/api/azure-assistants/az-asst-1',
                headers=self._headers('viewer', tenant_id='tenant-azure-iso'),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], 'az-asst-1')
        self.assertEqual(list_mock.call_args.kwargs['user']['tenant_id'], 'tenant-azure-iso')

    def test_azure_vector_store_aliases_delegate_to_base_handlers(self):
        upload_mock = AsyncMock(return_value=[{'id': 'file-1', 'filename': 'a.txt', 'bytes': 5}])

        with (
            patch.object(platform_compat, 'list_vector_stores', return_value=[{'id': 'vs-1'}]) as list_mock,
            patch.object(platform_compat, 'get_vector_store', return_value={'id': 'vs-1'}) as get_mock,
            patch.object(platform_compat, 'create_vector_store', return_value={'id': 'vs-2'}) as create_mock,
            patch.object(platform_compat, 'update_vector_store', return_value={'id': 'vs-2'}) as update_mock,
            patch.object(platform_compat, 'delete_vector_store', return_value={'status': 'deleted', 'id': 'vs-2'}) as delete_mock,
            patch.object(platform_compat, 'upload_files_to_vector_store', upload_mock),
            patch.object(platform_compat, 'delete_files_from_vector_store', return_value={'status': 'ok'}) as patch_mock,
        ):
            headers = self._headers('editor', tenant_id='tenant-vec-iso')

            list_resp = self.client.get('/api/azure-assistants-vector-store', headers=headers)
            get_resp = self.client.get('/api/azure-assistants-vector-store/vs-1', headers=headers)
            create_resp = self.client.post('/api/azure-assistants-vector-store', headers=headers, json={'name': 'VS'})
            update_resp = self.client.put('/api/azure-assistants-vector-store/vs-2', headers=headers, json={'name': 'VS2'})
            patch_resp = self.client.patch('/api/azure-assistants-vector-store/vs-2', headers=headers, json={'file_ids': ['f1']})
            upload_resp = self.client.post(
                '/api/azure-assistants-vector-store/vs-2',
                headers=headers,
                files=[('files', ('a.txt', b'hello', 'text/plain'))],
            )
            delete_resp = self.client.delete('/api/azure-assistants-vector-store/vs-2', headers=headers)

        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(create_resp.status_code, 200)
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(upload_resp.status_code, 200)
        self.assertEqual(delete_resp.status_code, 200)

        self.assertTrue(list_mock.called)
        self.assertTrue(get_mock.called)
        self.assertTrue(create_mock.called)
        self.assertTrue(update_mock.called)
        self.assertTrue(patch_mock.called)
        self.assertTrue(upload_mock.called)
        self.assertTrue(delete_mock.called)

        self.assertEqual(delete_mock.call_args.kwargs['user']['tenant_id'], 'tenant-vec-iso')

    def test_azure_file_upload_alias_delegates_to_openai_upload_handler(self):
        upload_mock = AsyncMock(return_value=[{'id': 'file-2', 'filename': 'b.txt', 'bytes': 3}])
        with patch.object(platform_compat, 'upload_files_to_openai_assistant', upload_mock):
            response = self.client.post(
                '/api/azure-assistants-file/upload',
                headers=self._headers('editor'),
                files=[('files', ('b.txt', b'hey', 'text/plain'))],
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['id'], 'file-2')
        self.assertTrue(upload_mock.called)


if __name__ == '__main__':
    unittest.main()
