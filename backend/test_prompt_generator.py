"""
Unit tests for PromptGenerator class
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from prompt_generator import PromptGenerator, create_prompt_generator


class TestPromptGeneratorInit:
    """Test PromptGenerator initialization"""

    def test_init_with_api_key(self):
        """Test initialization with explicit API key"""
        generator = PromptGenerator(api_key="test-key-123")
        assert generator.api_key == "test-key-123"
        assert generator.model == "gpt-4"
        assert generator.temperature == 0.7
        assert generator.max_tokens == 2000

    def test_init_with_env_var(self, monkeypatch):
        """Test initialization with API key from environment variable"""
        monkeypatch.setenv('OPENAI_API_KEY', 'env-key-456')
        generator = PromptGenerator()
        assert generator.api_key == "env-key-456"

    def test_init_without_api_key(self, monkeypatch):
        """Test initialization fails without API key"""
        monkeypatch.delenv('OPENAI_API_KEY', raising=False)
        with pytest.raises(ValueError, match="OpenAI API key must be provided"):
            PromptGenerator()

    def test_init_with_custom_params(self):
        """Test initialization with custom parameters"""
        generator = PromptGenerator(
            api_key="test-key",
            model="gpt-3.5-turbo",
            temperature=0.5,
            max_tokens=1000
        )
        assert generator.model == "gpt-3.5-turbo"
        assert generator.temperature == 0.5
        assert generator.max_tokens == 1000


class TestPromptGeneratorValidation:
    """Test input validation in generate_prompts"""

    @pytest.fixture
    def generator(self):
        return PromptGenerator(api_key="test-key")

    def test_empty_system_prompt(self, generator):
        """Test validation fails with empty system prompt"""
        with pytest.raises(ValueError, match="system_prompt cannot be empty"):
            generator.generate_prompts("", "user prompt", 3)

    def test_whitespace_system_prompt(self, generator):
        """Test validation fails with whitespace-only system prompt"""
        with pytest.raises(ValueError, match="system_prompt cannot be empty"):
            generator.generate_prompts("   ", "user prompt", 3)

    def test_empty_user_prompt(self, generator):
        """Test validation fails with empty user prompt"""
        with pytest.raises(ValueError, match="user_prompt cannot be empty"):
            generator.generate_prompts("system prompt", "", 3)

    def test_prompt_count_too_low(self, generator):
        """Test validation fails with prompt_count < 1"""
        with pytest.raises(ValueError, match="prompt_count must be at least 1"):
            generator.generate_prompts("system", "user", 0)

    def test_prompt_count_too_high(self, generator):
        """Test validation fails with prompt_count > 50"""
        with pytest.raises(ValueError, match="prompt_count cannot exceed 50"):
            generator.generate_prompts("system", "user", 51)


class TestPromptGeneratorGeneration:
    """Test prompt generation functionality"""

    @pytest.fixture
    def generator(self):
        return PromptGenerator(api_key="test-key")

    def test_generate_prompts_success_list_format(self, generator):
        """Test successful prompt generation with direct list response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps([
            "Episode 1: A hero emerges",
            "Episode 2: The journey begins",
            "Episode 3: Final confrontation"
        ])
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        prompts = generator.generate_prompts(
            system_prompt="You are a director",
            user_prompt="Generate episode prompts",
            prompt_count=3
        )

        assert len(prompts) == 3
        assert prompts[0] == "Episode 1: A hero emerges"
        assert prompts[1] == "Episode 2: The journey begins"
        assert prompts[2] == "Episode 3: Final confrontation"

    def test_generate_prompts_success_dict_format(self, generator):
        """Test successful prompt generation with dict response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "prompts": [
                "Prompt 1",
                "Prompt 2"
            ]
        })
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        prompts = generator.generate_prompts(
            system_prompt="System",
            user_prompt="User",
            prompt_count=2
        )

        assert len(prompts) == 2
        assert prompts[0] == "Prompt 1"
        assert prompts[1] == "Prompt 2"

    def test_generate_prompts_episodes_key(self, generator):
        """Test prompt generation with 'episodes' key in response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "episodes": [
                "Episode A",
                "Episode B",
                "Episode C"
            ]
        })
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        prompts = generator.generate_prompts("sys", "user", 3)

        assert len(prompts) == 3
        assert "Episode A" in prompts

    def test_generate_prompts_pads_if_fewer_returned(self, generator):
        """Test that prompts are padded if fewer than requested are returned"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps([
            "Prompt 1",
            "Prompt 2"
        ])
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        prompts = generator.generate_prompts("sys", "user", 4)

        assert len(prompts) == 4
        # Should pad with last prompt
        assert prompts[2] == "Prompt 2"
        assert prompts[3] == "Prompt 2"

    def test_generate_prompts_truncates_if_more_returned(self, generator):
        """Test that prompts are truncated if more than requested are returned"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps([
            "P1", "P2", "P3", "P4", "P5"
        ])
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        prompts = generator.generate_prompts("sys", "user", 3)

        assert len(prompts) == 3
        assert prompts == ["P1", "P2", "P3"]

    def test_generate_prompts_custom_temperature(self, generator):
        """Test that custom temperature is passed to API"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(["Prompt"])
        mock_create = Mock(return_value=mock_response)
        generator.client.chat.completions.create = mock_create

        generator.generate_prompts("sys", "user", 1, temperature=0.9)

        # Check that temperature was passed
        call_args = mock_create.call_args
        assert call_args[1]['temperature'] == 0.9

    def test_generate_prompts_custom_max_tokens(self, generator):
        """Test that custom max_tokens is passed to API"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(["Prompt"])
        mock_create = Mock(return_value=mock_response)
        generator.client.chat.completions.create = mock_create

        generator.generate_prompts("sys", "user", 1, max_tokens=500)

        # Check that max_tokens was passed
        call_args = mock_create.call_args
        assert call_args[1]['max_tokens'] == 500

    def test_generate_prompts_api_error(self, generator):
        """Test handling of OpenAI API errors"""
        generator.client.chat.completions.create = Mock(side_effect=Exception("API Error"))

        with pytest.raises(Exception):
            generator.generate_prompts("sys", "user", 2)

    def test_generate_prompts_invalid_json(self, generator):
        """Test handling of invalid JSON response"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Not valid JSON!"
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        with pytest.raises(ValueError, match="Invalid JSON response"):
            generator.generate_prompts("sys", "user", 2)

    def test_generate_prompts_unexpected_format(self, generator):
        """Test handling of unexpected response format"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "unexpected_key": "value"
        })
        generator.client.chat.completions.create = Mock(return_value=mock_response)

        with pytest.raises(ValueError, match="No valid prompts generated"):
            generator.generate_prompts("sys", "user", 2)


class TestGenerateEpisodePrompts:
    """Test generate_episode_prompts convenience method"""

    @pytest.fixture
    def generator(self):
        return PromptGenerator(api_key="test-key")

    def test_generate_episode_prompts_success(self, generator):
        """Test successful episode prompt generation"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps([
            "Episode 1 scene",
            "Episode 2 scene",
            "Episode 3 scene"
        ])
        mock_create = Mock(return_value=mock_response)
        generator.client.chat.completions.create = mock_create

        prompts = generator.generate_episode_prompts(
            outline="A story about a hero's journey",
            episode_count=3
        )

        assert len(prompts) == 3
        assert "Episode 1 scene" in prompts

        # Check that system prompt mentions film director
        call_args = mock_create.call_args
        system_message = call_args[1]['messages'][0]['content']
        assert "film director" in system_message.lower()

    def test_generate_episode_prompts_custom_temperature(self, generator):
        """Test episode prompts with custom temperature"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(["P1", "P2"])
        mock_create = Mock(return_value=mock_response)
        generator.client.chat.completions.create = mock_create

        generator.generate_episode_prompts("outline", 2, temperature=0.3)

        call_args = mock_create.call_args
        assert call_args[1]['temperature'] == 0.3


class TestFactoryFunction:
    """Test create_prompt_generator factory function"""

    def test_create_prompt_generator_default(self, monkeypatch):
        """Test factory creates generator with defaults"""
        monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
        generator = create_prompt_generator()

        assert isinstance(generator, PromptGenerator)
        assert generator.model == "gpt-4"
        assert generator.temperature == 0.7

    def test_create_prompt_generator_custom(self):
        """Test factory creates generator with custom params"""
        generator = create_prompt_generator(
            api_key="custom-key",
            model="gpt-3.5-turbo",
            temperature=0.5
        )

        assert generator.api_key == "custom-key"
        assert generator.model == "gpt-3.5-turbo"
        assert generator.temperature == 0.5


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
